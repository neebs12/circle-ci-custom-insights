import fs from 'fs/promises';
import path from 'path';
import { TimeoutAnalysisResult } from '../types';

type HandlerFunction = (x: any, inArray?: boolean, rootNode?: boolean) => string;
type Handlers = {
    [key: string]: HandlerFunction;
};

const trimWhitespace = (input: string): string => {
    return input
        .split("\n")
        .map((x) => x.trimEnd())
        .join("\n");
};

const typeOf = (obj: any): string => {
    const objectType = {}.toString.call(obj);
    const e = objectType.split(" ")[1];
    if (!e)
        return "unknown";
    return e.slice(0, -1).toLowerCase();
};

const typeNotAllowed = (type: string): Error => {
    return new Error(`JS Object/JSON with ${type} is not allowed when converting to YAML`);
};

const sanitizeKeys = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeKeys(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
            // Only trim leading/trailing whitespace, preserve spaces between words
            const sanitizedKey = key.trim();
            acc[sanitizedKey] = sanitizeKeys(obj[key]);
            return acc;
        }, {});
    }
    
    return obj;
};

let indentLevel = "";

const handlers: Handlers = {
    undefined: (): string => {
        return "null";
    },
    null: (): string => "null",
    number: (x: number): string => x.toString(),
    boolean: (x: boolean): string => (x ? "true" : "false"),
    string: (x: string): string => {
        return JSON.stringify(x);
    },
    array: (x: any[]): string => {
        if (x.length === 0)
            return "[]";
        let output = "";
        indentLevel = indentLevel.replace(/$/, "  ");
        for (const y of x) {
            const handler = handlers[typeOf(y)];
            if (!handler) {
                throw new Error(`what the crap: ${typeOf(y)}`);
            }
            output += `\n${indentLevel}- ${handler(y, true)}`;
        }
        indentLevel = indentLevel.replace(/ {2}/, "");
        return output;
    },
    object: (x: Record<string, any>, inArray?: boolean, rootNode?: boolean): string => {
        if (Object.keys(x).length === 0)
            return "{}";
        let output = "";
        if (!rootNode)
            indentLevel = indentLevel.replace(/$/, "  ");
        Object.keys(x).forEach((k, i) => {
            const val = x[k];
            const handler = handlers[typeOf(val)];
            if (typeof val === "undefined")
                return;
            if (!handler) {
                throw new Error(`[Corrupt state]: ${typeOf(val)}`);
            }
            if (!(inArray && i === 0))
                output += `\n${indentLevel}`;
            // Quote keys that contain spaces
            const key = k.includes(' ') ? JSON.stringify(k) : k;
            output += `${key}: ${handler(val)}`;
        });
        indentLevel = indentLevel.replace(/ {2}/, "");
        return output;
    },
    function: (): never => {
        throw typeNotAllowed("Function");
    },
    map: (): never => {
        throw typeNotAllowed("Map");
    },
    set: (): never => {
        throw typeNotAllowed("Set");
    },
};

const convert = (data: any): string => {
    const sanitizedData = sanitizeKeys(data);
    const handler = handlers[typeOf(sanitizedData)];
    return trimWhitespace(`${handler(sanitizedData, true, true)}\n`);
};

export async function generateTreeYaml(analysisDir: string, result: TimeoutAnalysisResult): Promise<void> {
    const yamlContent = convert({ tree: result.tree });
    const yamlPath = path.join(analysisDir, 'timedout-tree.yaml');
    await fs.writeFile(yamlPath, yamlContent);
    console.log('Tree YAML saved to outputs/analysis/timedout-tree.yaml');
}
