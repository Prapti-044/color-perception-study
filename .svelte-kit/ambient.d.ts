
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const VITE_BASE_PATH: string;
	export const VITE_FIREBASE_CONFIG: string;
	export const VITE_OPENAI_API_URL: string;
	export const VITE_RECAPTCHAV3TOKEN: string;
	export const VITE_REPO_URL: string;
	export const VITE_STORAGE_ENGINE: string;
	export const VITE_SUPABASE_ANON_KEY: string;
	export const VITE_SUPABASE_URL: string;
	export const SHELL: string;
	export const npm_package_scripts_typecheck: string;
	export const LESSHISTFILE: string;
	export const COLORTERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const npm_package_dependencies__mui_icons_material: string;
	export const XDG_MENU_PREFIX: string;
	export const npm_package_dependencies_ajv: string;
	export const npm_package_scripts_generate_library_examples: string;
	export const CURSOR_SPAWN_CHAIN: string;
	export const npm_package_dependencies_arquero: string;
	export const QT_IM_MODULES: string;
	export const npm_package_devDependencies__types_react: string;
	export const NODE: string;
	export const npm_config_ignore_scripts: string;
	export const LC_ADDRESS: string;
	export const VSCODE_PROCESS_TITLE: string;
	export const npm_package_dependencies_recoil: string;
	export const LC_NAME: string;
	export const SSH_AUTH_SOCK: string;
	export const XDG_DATA_HOME: string;
	export const npm_package_private: string;
	export const npm_package_devDependencies_vitest_localstorage_mock: string;
	export const npm_package_devDependencies__vitejs_plugin_react_swc: string;
	export const XDG_CONFIG_HOME: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const ELECTRON_RUN_AS_NODE: string;
	export const npm_config_argv: string;
	export const XMODIFIERS: string;
	export const GNUPGHOME: string;
	export const npm_config_bin_links: string;
	export const DESKTOP_SESSION: string;
	export const LC_MONETARY: string;
	export const NO_AT_BRIDGE: string;
	export const npm_package_dependencies_eslint_config_airbnb: string;
	export const CURSOR_EXTENSION_HOST_ROLE: string;
	export const EDITOR: string;
	export const GH_PAGER: string;
	export const npm_package_dependencies_jszip: string;
	export const npm_package_dependencies__mui_x_data_grid: string;
	export const PWD: string;
	export const npm_package_dependencies_remark_gfm: string;
	export const npm_config_save_prefix: string;
	export const LOGNAME: string;
	export const XDG_SESSION_DESKTOP: string;
	export const npm_package_dependencies__tabler_icons_react: string;
	export const XDG_SESSION_TYPE: string;
	export const npm_package_readmeFilename: string;
	export const npm_package_dependencies_react: string;
	export const npm_package_dependencies_ts_json_schema_generator: string;
	export const npm_package_dependencies_yaml: string;
	export const npm_package_devDependencies__typescript_eslint_parser: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const npm_package_scripts_generate_schema_GlobalConfig: string;
	export const SYSTEMD_EXEC_PID: string;
	export const npm_package_scripts_build: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const _: string;
	export const XAUTHORITY: string;
	export const npm_package_scripts_serve: string;
	export const npm_package_dependencies_diff: string;
	export const GJS_DEBUG_TOPICS: string;
	export const npm_package_devDependencies_eslint_plugin_react_hooks: string;
	export const MOTD_SHOWN: string;
	export const npm_package_devDependencies__types_react_dom: string;
	export const GDM_LANG: string;
	export const npm_package_dependencies_vega_lite: string;
	export const HOME: string;
	export const npm_package_dependencies_react_redux: string;
	export const USERNAME: string;
	export const npm_package_dependencies__quentinroy_latin_square: string;
	export const npm_config_version_git_tag: string;
	export const LANG: string;
	export const LC_PAPER: string;
	export const RUSTICL_ENABLE: string;
	export const npm_package_devDependencies_typescript: string;
	export const CURSOR_WORKSPACE_LABEL: string;
	export const CARGO_HOME: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_config_init_license: string;
	export const npm_package_scripts_generate_library_docs: string;
	export const npm_package_dependencies_uuid: string;
	export const npm_package_version: string;
	export const npm_package_scripts_unittest: string;
	export const npm_package_dependencies__supabase_supabase_js: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const VSCODE_IPC_HOOK: string;
	export const STARSHIP_SHELL: string;
	export const CLOUDSDK_ROOT_DIR: string;
	export const npm_package_devDependencies__typescript_eslint_eslint_plugin: string;
	export const WAYLAND_DISPLAY: string;
	export const STARSHIP_CONFIG: string;
	export const npm_config_version_commit_hooks: string;
	export const VSCODE_CLI: string;
	export const npm_package_devDependencies__eslint_eslintrc: string;
	export const npm_package_dependencies_crypto_js: string;
	export const npm_package_dependencies_wavesurfer_react: string;
	export const npm_package_dependencies__mantine_form: string;
	export const npm_package_scripts_generate_schema_StudyConfig: string;
	export const npm_package_scripts_generate_schema_LibraryConfig: string;
	export const INVOCATION_ID: string;
	export const npm_package_dependencies__dnd_kit_utilities: string;
	export const npm_package_dependencies_react_markdown: string;
	export const npm_package_dependencies_react_vega: string;
	export const npm_package_dependencies_d3: string;
	export const CURSOR_LAYOUT: string;
	export const npm_package_dependencies__mantine_modals: string;
	export const npm_package_dependencies__emotion_styled: string;
	export const MANAGERPID: string;
	export const npm_package_devDependencies_husky: string;
	export const npm_package_dependencies__mantine_dates: string;
	export const npm_package_dependencies__types_crypto_js: string;
	export const INIT_CWD: string;
	export const CHROME_DESKTOP: string;
	export const npm_package_devDependencies_eslint_plugin_import: string;
	export const npm_package_dependencies_vega: string;
	export const STARSHIP_SESSION_KEY: string;
	export const XDG_CACHE_HOME: string;
	export const npm_package_dependencies_use_deep_compare_effect: string;
	export const npm_package_dependencies_hjson: string;
	export const npm_lifecycle_script: string;
	export const npm_package_description: string;
	export const GJS_DEBUG_OUTPUT: string;
	export const npm_package_dependencies__visdesignlab_upset2_react: string;
	export const GNOME_SETUP_DISPLAY: string;
	export const npm_package_dependencies__emotion_react: string;
	export const npm_config_version_tag_prefix: string;
	export const GRADLE_USER_HOME: string;
	export const YARN_WRAP_OUTPUT: string;
	export const npm_package_dependencies__dnd_kit_core: string;
	export const npm_package_devDependencies__types_topojson_client: string;
	export const npm_package_dependencies__trrack_core: string;
	export const npm_package_dependencies_topojson_client: string;
	export const npm_package_dependencies_rehype_raw: string;
	export const XDG_SESSION_CLASS: string;
	export const LC_IDENTIFICATION: string;
	export const TERM: string;
	export const npm_package_lint_staged____tsx_jsx_ts_js_: string;
	export const npm_package_name: string;
	export const npm_package_dependencies__types_node: string;
	export const CODEX_THREAD_ID: string;
	export const npm_package_dependencies__types_hjson: string;
	export const ZDOTDIR: string;
	export const npm_package_type: string;
	export const GOOGLE_CLOUD_SDK_HOME: string;
	export const USER: string;
	export const GIT_PAGER: string;
	export const npm_package_devDependencies_vitest: string;
	export const npm_package_dependencies__mantine_core: string;
	export const npm_package_dependencies_react_dom: string;
	export const npm_package_dependencies_localforage: string;
	export const npm_package_dependencies_typedoc_plugin_markdown: string;
	export const npm_package_dependencies_plyr_react: string;
	export const VISUAL: string;
	export const npm_package_devDependencies__types_d3: string;
	export const npm_package_dependencies__tanstack_react_virtual: string;
	export const DISPLAY: string;
	export const npm_package_devDependencies_lint_staged: string;
	export const npm_package_devDependencies_eslint_plugin_jsx_a11y: string;
	export const npm_lifecycle_event: string;
	export const npm_package_devDependencies__eslint_compat: string;
	export const VSCODE_PID: string;
	export const SHLVL: string;
	export const npm_config_version_git_sign: string;
	export const npm_package_scripts_generate_schemas: string;
	export const npm_package_dependencies__reduxjs_toolkit: string;
	export const npm_package_dependencies__dnd_kit_sortable: string;
	export const npm_package_dependencies_typedoc: string;
	export const npm_config_version_git_message: string;
	export const PAGER: string;
	export const npm_package_devDependencies_eslint: string;
	export const LC_TELEPHONE: string;
	export const npm_package_dependencies_firebase: string;
	export const QT_IM_MODULE: string;
	export const npm_package_dependencies__mui_system: string;
	export const LC_MEASUREMENT: string;
	export const VSCODE_CWD: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const NO_COLOR: string;
	export const npm_package_scripts_lint: string;
	export const npm_execpath: string;
	export const FC_FONTATIONS: string;
	export const npm_package_dependencies_mantine_react_table: string;
	export const CODEX_CI: string;
	export const npm_package_scripts_test: string;
	export const LC_CTYPE: string;
	export const npm_package_dependencies_lodash_isequal: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const XDG_RUNTIME_DIR: string;
	export const npm_config_strict_ssl: string;
	export const npm_package_devDependencies__types_uuid: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_dependencies_lodash_merge: string;
	export const LC_TIME: string;
	export const CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
	export const LC_ALL: string;
	export const npm_package_dependencies__mantine_notifications: string;
	export const ELECTRON_NO_ATTACH_CONSOLE: string;
	export const npm_package_dependencies_vite: string;
	export const JOURNAL_STREAM: string;
	export const npm_package_dependencies__mantine_hooks: string;
	export const npm_package_dependencies_colorjs_io: string;
	export const XDG_DATA_DIRS: string;
	export const GDK_BACKEND: string;
	export const CODEX_SANDBOX_NETWORK_DISABLED: string;
	export const CURSOR_SPAWNED_BY_EXTENSION_ID: string;
	export const PATH: string;
	export const GDMSESSION: string;
	export const XDG_SESSION_EXTRA_DEVICE_ACCESS: string;
	export const npm_package_devDependencies_eslint_plugin_react: string;
	export const npm_package_dependencies_dayjs: string;
	export const npm_package_devDependencies_globals: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_package_devDependencies__playwright_test: string;
	export const npm_package_license: string;
	export const npm_package_dependencies_react_router: string;
	export const npm_package_scripts_postinstall: string;
	export const RUST_LOG: string;
	export const VSCODE_NLS_CONFIG: string;
	export const npm_package_dependencies_lodash_throttle: string;
	export const MAIL: string;
	export const npm_config_registry: string;
	export const npm_package_devDependencies__types_lodash_isequal: string;
	export const DEBUG: string;
	export const npm_config_ignore_optional: string;
	export const npm_package_scripts_buildDocs: string;
	export const npm_package_dependencies_wavesurfer_js: string;
	export const npm_package_dependencies__mui_material: string;
	export const GIO_LAUNCHED_DESKTOP_FILE_PID: string;
	export const npm_node_execpath: string;
	export const GIO_LAUNCHED_DESKTOP_FILE: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const LC_NUMERIC: string;
	export const npm_package_devDependencies__eslint_js: string;
	export const npm_package_scripts_preinstall: string;
	export const GOPATH: string;
	export const npm_package_dependencies_lodash_debounce: string;
	export const npm_config_init_version: string;
	export const TEST: string;
	export const VITEST: string;
	export const NODE_ENV: string;
	export const PROD: string;
	export const DEV: string;
	export const BASE_URL: string;
	export const MODE: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		VITE_BASE_PATH: string;
		VITE_FIREBASE_CONFIG: string;
		VITE_OPENAI_API_URL: string;
		VITE_RECAPTCHAV3TOKEN: string;
		VITE_REPO_URL: string;
		VITE_STORAGE_ENGINE: string;
		VITE_SUPABASE_ANON_KEY: string;
		VITE_SUPABASE_URL: string;
		SHELL: string;
		npm_package_scripts_typecheck: string;
		LESSHISTFILE: string;
		COLORTERM: string;
		XDG_CONFIG_DIRS: string;
		npm_package_dependencies__mui_icons_material: string;
		XDG_MENU_PREFIX: string;
		npm_package_dependencies_ajv: string;
		npm_package_scripts_generate_library_examples: string;
		CURSOR_SPAWN_CHAIN: string;
		npm_package_dependencies_arquero: string;
		QT_IM_MODULES: string;
		npm_package_devDependencies__types_react: string;
		NODE: string;
		npm_config_ignore_scripts: string;
		LC_ADDRESS: string;
		VSCODE_PROCESS_TITLE: string;
		npm_package_dependencies_recoil: string;
		LC_NAME: string;
		SSH_AUTH_SOCK: string;
		XDG_DATA_HOME: string;
		npm_package_private: string;
		npm_package_devDependencies_vitest_localstorage_mock: string;
		npm_package_devDependencies__vitejs_plugin_react_swc: string;
		XDG_CONFIG_HOME: string;
		MEMORY_PRESSURE_WRITE: string;
		ELECTRON_RUN_AS_NODE: string;
		npm_config_argv: string;
		XMODIFIERS: string;
		GNUPGHOME: string;
		npm_config_bin_links: string;
		DESKTOP_SESSION: string;
		LC_MONETARY: string;
		NO_AT_BRIDGE: string;
		npm_package_dependencies_eslint_config_airbnb: string;
		CURSOR_EXTENSION_HOST_ROLE: string;
		EDITOR: string;
		GH_PAGER: string;
		npm_package_dependencies_jszip: string;
		npm_package_dependencies__mui_x_data_grid: string;
		PWD: string;
		npm_package_dependencies_remark_gfm: string;
		npm_config_save_prefix: string;
		LOGNAME: string;
		XDG_SESSION_DESKTOP: string;
		npm_package_dependencies__tabler_icons_react: string;
		XDG_SESSION_TYPE: string;
		npm_package_readmeFilename: string;
		npm_package_dependencies_react: string;
		npm_package_dependencies_ts_json_schema_generator: string;
		npm_package_dependencies_yaml: string;
		npm_package_devDependencies__typescript_eslint_parser: string;
		VSCODE_ESM_ENTRYPOINT: string;
		npm_package_scripts_generate_schema_GlobalConfig: string;
		SYSTEMD_EXEC_PID: string;
		npm_package_scripts_build: string;
		VSCODE_CODE_CACHE_PATH: string;
		_: string;
		XAUTHORITY: string;
		npm_package_scripts_serve: string;
		npm_package_dependencies_diff: string;
		GJS_DEBUG_TOPICS: string;
		npm_package_devDependencies_eslint_plugin_react_hooks: string;
		MOTD_SHOWN: string;
		npm_package_devDependencies__types_react_dom: string;
		GDM_LANG: string;
		npm_package_dependencies_vega_lite: string;
		HOME: string;
		npm_package_dependencies_react_redux: string;
		USERNAME: string;
		npm_package_dependencies__quentinroy_latin_square: string;
		npm_config_version_git_tag: string;
		LANG: string;
		LC_PAPER: string;
		RUSTICL_ENABLE: string;
		npm_package_devDependencies_typescript: string;
		CURSOR_WORKSPACE_LABEL: string;
		CARGO_HOME: string;
		XDG_CURRENT_DESKTOP: string;
		npm_config_init_license: string;
		npm_package_scripts_generate_library_docs: string;
		npm_package_dependencies_uuid: string;
		npm_package_version: string;
		npm_package_scripts_unittest: string;
		npm_package_dependencies__supabase_supabase_js: string;
		MEMORY_PRESSURE_WATCH: string;
		VSCODE_IPC_HOOK: string;
		STARSHIP_SHELL: string;
		CLOUDSDK_ROOT_DIR: string;
		npm_package_devDependencies__typescript_eslint_eslint_plugin: string;
		WAYLAND_DISPLAY: string;
		STARSHIP_CONFIG: string;
		npm_config_version_commit_hooks: string;
		VSCODE_CLI: string;
		npm_package_devDependencies__eslint_eslintrc: string;
		npm_package_dependencies_crypto_js: string;
		npm_package_dependencies_wavesurfer_react: string;
		npm_package_dependencies__mantine_form: string;
		npm_package_scripts_generate_schema_StudyConfig: string;
		npm_package_scripts_generate_schema_LibraryConfig: string;
		INVOCATION_ID: string;
		npm_package_dependencies__dnd_kit_utilities: string;
		npm_package_dependencies_react_markdown: string;
		npm_package_dependencies_react_vega: string;
		npm_package_dependencies_d3: string;
		CURSOR_LAYOUT: string;
		npm_package_dependencies__mantine_modals: string;
		npm_package_dependencies__emotion_styled: string;
		MANAGERPID: string;
		npm_package_devDependencies_husky: string;
		npm_package_dependencies__mantine_dates: string;
		npm_package_dependencies__types_crypto_js: string;
		INIT_CWD: string;
		CHROME_DESKTOP: string;
		npm_package_devDependencies_eslint_plugin_import: string;
		npm_package_dependencies_vega: string;
		STARSHIP_SESSION_KEY: string;
		XDG_CACHE_HOME: string;
		npm_package_dependencies_use_deep_compare_effect: string;
		npm_package_dependencies_hjson: string;
		npm_lifecycle_script: string;
		npm_package_description: string;
		GJS_DEBUG_OUTPUT: string;
		npm_package_dependencies__visdesignlab_upset2_react: string;
		GNOME_SETUP_DISPLAY: string;
		npm_package_dependencies__emotion_react: string;
		npm_config_version_tag_prefix: string;
		GRADLE_USER_HOME: string;
		YARN_WRAP_OUTPUT: string;
		npm_package_dependencies__dnd_kit_core: string;
		npm_package_devDependencies__types_topojson_client: string;
		npm_package_dependencies__trrack_core: string;
		npm_package_dependencies_topojson_client: string;
		npm_package_dependencies_rehype_raw: string;
		XDG_SESSION_CLASS: string;
		LC_IDENTIFICATION: string;
		TERM: string;
		npm_package_lint_staged____tsx_jsx_ts_js_: string;
		npm_package_name: string;
		npm_package_dependencies__types_node: string;
		CODEX_THREAD_ID: string;
		npm_package_dependencies__types_hjson: string;
		ZDOTDIR: string;
		npm_package_type: string;
		GOOGLE_CLOUD_SDK_HOME: string;
		USER: string;
		GIT_PAGER: string;
		npm_package_devDependencies_vitest: string;
		npm_package_dependencies__mantine_core: string;
		npm_package_dependencies_react_dom: string;
		npm_package_dependencies_localforage: string;
		npm_package_dependencies_typedoc_plugin_markdown: string;
		npm_package_dependencies_plyr_react: string;
		VISUAL: string;
		npm_package_devDependencies__types_d3: string;
		npm_package_dependencies__tanstack_react_virtual: string;
		DISPLAY: string;
		npm_package_devDependencies_lint_staged: string;
		npm_package_devDependencies_eslint_plugin_jsx_a11y: string;
		npm_lifecycle_event: string;
		npm_package_devDependencies__eslint_compat: string;
		VSCODE_PID: string;
		SHLVL: string;
		npm_config_version_git_sign: string;
		npm_package_scripts_generate_schemas: string;
		npm_package_dependencies__reduxjs_toolkit: string;
		npm_package_dependencies__dnd_kit_sortable: string;
		npm_package_dependencies_typedoc: string;
		npm_config_version_git_message: string;
		PAGER: string;
		npm_package_devDependencies_eslint: string;
		LC_TELEPHONE: string;
		npm_package_dependencies_firebase: string;
		QT_IM_MODULE: string;
		npm_package_dependencies__mui_system: string;
		LC_MEASUREMENT: string;
		VSCODE_CWD: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		NO_COLOR: string;
		npm_package_scripts_lint: string;
		npm_execpath: string;
		FC_FONTATIONS: string;
		npm_package_dependencies_mantine_react_table: string;
		CODEX_CI: string;
		npm_package_scripts_test: string;
		LC_CTYPE: string;
		npm_package_dependencies_lodash_isequal: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		XDG_RUNTIME_DIR: string;
		npm_config_strict_ssl: string;
		npm_package_devDependencies__types_uuid: string;
		DEBUGINFOD_URLS: string;
		npm_package_dependencies_lodash_merge: string;
		LC_TIME: string;
		CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
		LC_ALL: string;
		npm_package_dependencies__mantine_notifications: string;
		ELECTRON_NO_ATTACH_CONSOLE: string;
		npm_package_dependencies_vite: string;
		JOURNAL_STREAM: string;
		npm_package_dependencies__mantine_hooks: string;
		npm_package_dependencies_colorjs_io: string;
		XDG_DATA_DIRS: string;
		GDK_BACKEND: string;
		CODEX_SANDBOX_NETWORK_DISABLED: string;
		CURSOR_SPAWNED_BY_EXTENSION_ID: string;
		PATH: string;
		GDMSESSION: string;
		XDG_SESSION_EXTRA_DEVICE_ACCESS: string;
		npm_package_devDependencies_eslint_plugin_react: string;
		npm_package_dependencies_dayjs: string;
		npm_package_devDependencies_globals: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_package_devDependencies__playwright_test: string;
		npm_package_license: string;
		npm_package_dependencies_react_router: string;
		npm_package_scripts_postinstall: string;
		RUST_LOG: string;
		VSCODE_NLS_CONFIG: string;
		npm_package_dependencies_lodash_throttle: string;
		MAIL: string;
		npm_config_registry: string;
		npm_package_devDependencies__types_lodash_isequal: string;
		DEBUG: string;
		npm_config_ignore_optional: string;
		npm_package_scripts_buildDocs: string;
		npm_package_dependencies_wavesurfer_js: string;
		npm_package_dependencies__mui_material: string;
		GIO_LAUNCHED_DESKTOP_FILE_PID: string;
		npm_node_execpath: string;
		GIO_LAUNCHED_DESKTOP_FILE: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		LC_NUMERIC: string;
		npm_package_devDependencies__eslint_js: string;
		npm_package_scripts_preinstall: string;
		GOPATH: string;
		npm_package_dependencies_lodash_debounce: string;
		npm_config_init_version: string;
		TEST: string;
		VITEST: string;
		NODE_ENV: string;
		PROD: string;
		DEV: string;
		BASE_URL: string;
		MODE: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
