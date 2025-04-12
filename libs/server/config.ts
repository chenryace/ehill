import yaml from 'js-yaml';
import * as env from 'libs/shared/env';
import { existsSync, readFileSync } from 'fs';
import {
    coerceToValidCause,
    createLogger,
    Issue,
    IssueCategory,
    IssueFixRecommendation,
    IssueSeverity,
} from 'libs/server/debugging';

const logger = createLogger('config');

export type BasicUser = { username: string; password: string };
type BasicMultiUserConfiguration = {
    username?: never;
    password?: never;
    users: BasicUser[];
};
type BasicSingleUserConfiguration = { username?: string; password: string } & {
    users?: never;
};
export type BasicAuthConfiguration = { type: 'basic' } & (
    | BasicSingleUserConfiguration
    | BasicMultiUserConfiguration
);
export type AuthConfiguration = { type: 'none' } | BasicAuthConfiguration;

export interface S3StoreConfiguration {
    type: 's3';
    detectCredentials: boolean;
    accessKey?: string;
    secretKey?: string;
    bucket: string;
    endpoint: string;
    region: string;
    forcePathStyle: boolean;
    prefix: string;
    proxyAttachments: boolean;
}

export interface PostgreSQLStoreConfiguration {
    type: 'postgresql';
    connectionString: string;
    prefix: string;
}

export type StoreConfiguration = S3StoreConfiguration | PostgreSQLStoreConfiguration;

export interface ServerConfiguration {
    useSecureCookies: boolean;
    baseUrl?: string;
}

export interface Configuration {
    auth: AuthConfiguration;
    store: StoreConfiguration;
    server: ServerConfiguration;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let loaded: Configuration | undefined = undefined;

enum ErrTitle {
    CONFIG_FILE_READ_FAIL = 'Failed to load configuration file',
    INVALID_AUTH_CONFIG = 'Invalid authorisation configuration',
    CONFIG_FILE_PARSE_FAIL = 'Could not parse configuration file',
    INVALID_STORE_CONFIG = 'Invalid store configuration',
}

enum ErrInstruction {
    ENV_EDIT = 'If using Vercel or Netlify, go to the environment settings. If using an environment file, edit that file.',
    CONFIG_FILE_OPEN = 'Edit the configuration file. Note that this does not work for Vercel nor Netlify.',
}

export function loadConfigAndListErrors(): {
    config?: Configuration;
    errors: Array<Issue>;
} {
    logger.debug(
        'Loading configuration from scratch (loadConfigAndListErrors)'
    );
    // TODO: More config errors
    const configFile = env.getEnvRaw('CONFIG_FILE', false) ?? './notea.yml';
    const errors: Array<Issue> = [];

    function tryElseAddError(f: () => void, issue: (e: any) => Issue): void {
        try {
            f();
        } catch (e) {
            errors.push(issue(e));
        }
    }

    let baseConfig: Configuration = {} as Configuration;
    if (existsSync(configFile)) {
        let data;
        try {
            data = readFileSync(configFile, 'utf-8');
        } catch (e) {
            errors.push({
                name: ErrTitle.CONFIG_FILE_READ_FAIL,
                description: "The configuration file couldn't be read.",
                cause: coerceToValidCause(e),
                severity: IssueSeverity.WARNING,
                category: IssueCategory.CONFIG,
                fixes: [
                    {
                        description:
                            'Make sure Notea has read access to the configuration file',
                        recommendation: IssueFixRecommendation.NEUTRAL,
                    },
                    {
                        description:
                            'Make sure no other programme is using the configuration file',
                        recommendation: IssueFixRecommendation.NEUTRAL,
                    },
                ],
            });
        }
        if (data) {
            try {
                baseConfig = yaml.load(data) as Configuration;
            } catch (e) {
                errors.push({
                    name: ErrTitle.CONFIG_FILE_PARSE_FAIL,
                    description:
                        'The configuration file could not be parsed, probably due to a syntax error.',
                    severity: IssueSeverity.WARNING,
                    category: IssueCategory.CONFIG,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description:
                                'Check your configuration file for syntax errors.',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                    ],
                });
            }
        }
    }

    const disablePassword = env.parseBool(
        env.getEnvRaw('DISABLE_PASSWORD', false),
        false
    );

    let auth: AuthConfiguration = { type: 'none' };
    if (!disablePassword) {
        const envPassword = env.getEnvRaw('PASSWORD', false);
        if (baseConfig.auth === undefined) {
            if (envPassword === undefined) {
                errors.push({
                    name: ErrTitle.INVALID_AUTH_CONFIG,
                    description:
                        'Neither the configuration file, the PASSWORD environment variable, nor the DISABLE_PASSWORD environment variable was set.',
                    severity: IssueSeverity.FATAL_ERROR,
                    category: IssueCategory.CONFIG,
                    fixes: [
                        {
                            description:
                                'Set the PASSWORD environment variable',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.ENV_EDIT,
                                'Set a variable with PASSWORD as key and your desired password as the variable.',
                            ],
                        },
                        {
                            description:
                                'Include an auth section in the configuration file',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.CONFIG_FILE_OPEN,
                                'Configure the auth section as you desire the authentication to work. Note that as of now it only supports basic authentication.',
                            ],
                        },
                        {
                            description: 'Disable authentication',
                            recommendation: IssueFixRecommendation.NOT_ADVISED,
                            steps: [
                                'Set either the DISABLE_PASSWORD environment variable or set auth.type to none in the configuration file.',
                            ],
                        },
                    ],
                });
            } else {
                auth = {
                    type: 'basic',
                    password: envPassword.toString(),
                };
            }
        } else {
            auth = baseConfig.auth;
            if (envPassword !== undefined) {
                errors.push({
                    name: ErrTitle.INVALID_AUTH_CONFIG,
                    description:
                        'The PASSWORD environment variable cannot be set when the file configuration contains an auth section.',
                    category: IssueCategory.CONFIG,
                    severity: IssueSeverity.FATAL_ERROR,
                    fixes: [
                        {
                            description:
                                "Don't set the PASSWORD environment variable prior to running Notea.",
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description:
                                'Remove the auth section from your file configuration.',
                            recommendation: IssueFixRecommendation.NEUTRAL,
                        },
                    ],
                });
            }
            if (auth.type === 'basic') {
                if (auth.users) {
                    // TEMPORARILY;
                    errors.push({
                        name: ErrTitle.INVALID_AUTH_CONFIG,
                        description: 'Multiple users are not yet supported',
                        severity: IssueSeverity.FATAL_ERROR,
                        category: IssueCategory.CONFIG,
                        fixes: [
                            {
                                description:
                                    'Change to a single-user configuration.',
                                recommendation:
                                    IssueFixRecommendation.RECOMMENDED,
                            },
                        ],
                    });

                    /*for (const user of auth.users) {
                        user.username = user.username.toString();
                        user.password = user.password.toString();
                    }*/
                } else {
                    auth.username = auth.username?.toString();
                    auth.password = auth.password.toString();
                }
            }
        }
    } else {
        auth = { type: 'none' };
    }

    let store: StoreConfiguration;

    if (!baseConfig.store) {
        store = {} as StoreConfiguration;
    } else {
        store = baseConfig.store;
    }

    // 检查存储类型
    const storeType = env.getEnvRaw('STORE_TYPE', false) || store.type || 's3';
    
    if (storeType === 'postgresql') {
        // PostgreSQL 存储配置
        try {
            (store as PostgreSQLStoreConfiguration).type = 'postgresql';
            
            // 获取连接字符串
            tryElseAddError(
                () => {
                    (store as PostgreSQLStoreConfiguration).connectionString =
                        env.getEnvRaw('STORE_CONNECTION_STRING', !(store as PostgreSQLStoreConfiguration).connectionString) ?? 
                        (store as PostgreSQLStoreConfiguration).connectionString;
                },
                (e) => ({
                    name: 'PostgreSQL连接字符串未提供',
                    category: IssueCategory.CONFIG,
                    description: '未向Notea提供PostgreSQL连接字符串。',
                    severity: IssueSeverity.FATAL_ERROR,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description: '设置STORE_CONNECTION_STRING环境变量',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description: '在配置文件中设置store.connectionString',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                    ],
                })
            );
            
            // 获取前缀
            (store as PostgreSQLStoreConfiguration).prefix =
                env.getEnvRaw('STORE_PREFIX', false) ?? 
                (store as PostgreSQLStoreConfiguration).prefix ?? '';
        } catch (e) {
            errors.push({
                name: ErrTitle.INVALID_STORE_CONFIG,
                description: '无法加载PostgreSQL存储配置',
                severity: IssueSeverity.FATAL_ERROR,
                category: IssueCategory.CONFIG,
                cause: coerceToValidCause(e),
                fixes: [],
            });
        }
    } else {
        // S3 存储配置 (默认)
        try {
            (store as S3StoreConfiguration).type = 's3';
            (store as S3StoreConfiguration).detectCredentials ??= true;
            tryElseAddError(
                () => {
                    (store as S3StoreConfiguration).accessKey =
                        env.getEnvRaw(
                            'STORE_ACCESS_KEY',
                            !(store as S3StoreConfiguration).detectCredentials && !(store as S3StoreConfiguration).accessKey
                        ) ?? (store as S3StoreConfiguration).accessKey;
                },
                (e) => ({
                    name: 'Store access key was not provided',
                    category: IssueCategory.CONFIG,
                    description:
                        'The store access key was not provided to Notea, and detecting credentials is disabled.',
                    severity: IssueSeverity.FATAL_ERROR,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description:
                                'Set the STORE_ACCESS_KEY environment variable',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description:
                                'Set store.accessKey in the configuration file',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description: 'Allow autodetection of credentials',
                            recommendation: IssueFixRecommendation.NEUTRAL,
                        },
                    ],
                })
            );
            tryElseAddError(
                () => {
                    (store as S3StoreConfiguration).secretKey =
                        env.getEnvRaw(
                            'STORE_SECRET_KEY',
                            !(store as S3StoreConfiguration).detectCredentials && !(store as S3StoreConfiguration).secretKey
                        ) ?? (store as S3StoreConfiguration).secretKey;
                },
                (e) => ({
                    name: 'Store secret key was not provided',
                    category: IssueCategory.CONFIG,
                    description:
                        'The store secret key was not provided to Notea, and detecting credentials is disabled.',
                    severity: IssueSeverity.FATAL_ERROR,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description:
                                'Set the STORE_SECRET_KEY environment variable',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description:
                                'Set store.secretKey in the configuration file',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                        },
                        {
                            description: 'Allow autodetection of credentials',
                            recommendation: IssueFixRecommendation.NEUTRAL,
                        },
                    ],
                })
            );
            (store as S3StoreConfiguration).bucket = env.getEnvRaw('STORE_BUCKET', false) ?? 'notea';
            (store as S3StoreConfiguration).forcePathStyle =
                env.parseBool(env.getEnvRaw('STORE_FORCE_PATH_STYLE', false)) ??
                (store as S3StoreConfiguration).forcePathStyle ??
                false;
            tryElseAddError(
                () => {
                    (store as S3StoreConfiguration).endpoint =
                        env.getEnvRaw('STORE_END_POINT', (store as S3StoreConfiguration).endpoint == null) ??
                        (store as S3StoreConfiguration).endpoint;
                },
                (e) => ({
                    name: 'Store endpoint was not provided',
                    category: IssueCategory.CONFIG,
                    description: 'The store endpoint was not provided to Notea.',
                    severity: IssueSeverity.FATAL_ERROR,
                    cause: coerceToValidCause(e),
                    fixes: [
                        {
                            description:
                                'Set the STORE_END_POINT environment variable',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.ENV_EDIT,
                                "Set a variable with STORE_END_POINT as key and your store's endpoint as the variable. Note that the endpoint must be resolvable by the server Notea runs on.",
                            ],
                        },
                        {
                            description:
                                'Set store.endpoint in the configuration file',
                            recommendation: IssueFixRecommendation.RECOMMENDED,
                            steps: [
                                ErrInstruction.CONFIG_FILE_OPEN,
                                "In the store section, set endpoint to your store's endpoint.",
                            ],
                        },
                    ],
                })
            );
            (store as S3StoreConfiguration).region =
                env.getEnvRaw('STORE_REGION', false) ?? (store as S3StoreConfiguration).region ?? 'us-east-1';
            (store as S3StoreConfiguration).prefix =
                env.getEnvRaw('STORE_PREFIX', false) ?? (store as S3StoreConfiguration).prefix ?? '';
            (store as S3StoreConfiguration).proxyAttachments = env.parseBool(
                env.getEnvRaw('DIRECT_RESPONSE_ATTACHMENT', false),
                (store as S3StoreConfiguration).proxyAttachments ?? false
            );
        } catch (e) {
            errors.push({
                name: ErrTitle.INVALID_STORE_CONFIG,
                description: 'Could not load configuration for store',
                severity: IssueSeverity.FATAL_ERROR,
                category: IssueCategory.CONFIG,
                cause: coerceToValidCause(e),
                fixes: [],
            });
        }
    }

    let server: ServerConfiguration;
    if (!baseConfig.server) {
        server = {} as ServerConfiguration;
    } else {
        server = baseConfig.server;
    }
    {
        server.useSecureCookies = env.parseBool(
            env.getEnvRaw('COOKIE_SECURE', false),
            server.useSecureCookies ?? process.env.NODE_ENV === 'production'
        );
        server.baseUrl = env.getEnvRaw('BASE_URL', false) ?? server.baseUrl;
    }

    return {
        config: {
            auth,
            store,
            server,
        },
        errors,
    };
}

const MAX_ERRORS = 2;
export function loadConfig() {
    const result = loadConfigAndListErrors();

    if (!result.config) {
        const { errors } = result;
        let name = errors
            .slice(0, MAX_ERRORS)
            .map((v) => v.name)
            .join(', ');
        if (errors.length > MAX_ERRORS) {
            const rest = errors.length - MAX_ERRORS;
            name += ' and ' + rest + ' other error' + (rest > 1 ? 's' : '');
        }
        throw new Error(name);
    }

    loaded = result.config;

    return loaded;
}

export function config(): Configuration {
    if (!loaded) {
        logger.debug('Loading configuration');
        loadConfig();
        logger.debug('Successfully loaded configuration');
    }

    return loaded;
}
