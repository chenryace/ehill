import { loadConfigAndListErrors } from 'libs/server/config';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import * as path from 'path';
import * as fs from 'fs';
import { coerceToValidCause, DebugInformation, Issue, IssueCategory, IssueSeverity } from 'libs/shared/debugging';
import Logger = pino.Logger;

export * from 'libs/shared/debugging'; // here's a lil' lesson in trickery

const serialRuntimeIssues: Array<Issue> = [];
const keyedRuntimeIssues: Record<keyof any, Issue | undefined> = {};
export function reportRuntimeIssue(issue: Issue) {
    const complete = {
        ...issue,
        isRuntime: true
    };
    serialRuntimeIssues.push(complete);
}
export function setKeyedRuntimeIssue(key: keyof typeof keyedRuntimeIssues, issue: Issue | null) {
    if (issue === null) {
        delete keyedRuntimeIssues[key];
    } else {
        keyedRuntimeIssues[key] = issue;
    }
}
function getAllKeyedRuntimeIssues(): Array<Issue> {
    const values: Array<Issue> = [];
    Object.values(keyedRuntimeIssues).forEach((v) => {
        if (v != undefined) { // non-strict equality because that's better for null checks
            values.push(v);
        }
    });
    return values;
}

export function findIssues(): Array<Issue> {
    const issues: Array<Issue> = [];

    try {
        const cfg = loadConfigAndListErrors();
        issues.push(...cfg.errors);
    } catch (e) {
        issues.push({
            severity: IssueSeverity.FATAL_ERROR,
            category: IssueCategory.CONFIG,
            name: "Cannot load config",
            cause: coerceToValidCause(e),
            fixes: []
        });
    }

    issues.push(...serialRuntimeIssues, ...getAllKeyedRuntimeIssues());

    return issues;
}

export function collectDebugInformation(): DebugInformation {
    const issues = findIssues();
    return {
        issues,
        logs: []
    };
}

function getLogFile(name: string) {
    // 检测是否在Vercel环境中
    const isVercel = process.env.VERCEL === '1';
    // 根据环境选择日志目录
    const dir = isVercel 
        ? path.resolve('/tmp/logs') 
        : path.resolve(process.cwd(), process.env.LOG_DIRECTORY ?? 'logs');

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
        return path.resolve(dir, `${name}.log`);
    } catch (e) {
        console.warn(`无法创建日志目录 ${dir}:`, e);
        return null;
    }
}

const loggerTransport: Parameters<typeof pino.multistream>[0] = [
    {
        stream: pinoPretty(),
        level: "info"
    }
];

// 获取日志文件路径
const logFilePath = getLogFile('debug');
// 只有在日志文件路径有效时才添加文件日志
if (logFilePath) {
    try {
        loggerTransport.push({
            stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
            level: "debug"
        });
    } catch (e) {
        console.warn("无法创建文件日志:", e);
    }
}

try {
    loggerTransport.push({
        stream: fs.createWriteStream(getLogFile('debug'), { flags: 'a' }),
        level: "debug"
    });
} catch (e) {
    // well, whoops!
    console.warn("No file logs: %O", e);
}

const multistream = pino.multistream(loggerTransport);

export function createLogger(name: string): Logger {
    return pino({
        name,
        level: "trace",
    }, multistream);
}

export type { Logger };