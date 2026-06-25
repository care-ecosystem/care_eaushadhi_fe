export interface PlugConfigMeta {
  url?: string;
  name?: string;
  config?: {
    schema_version?: boolean;
    credentials_ref?: boolean;
    disable_inward_date?: boolean;
    manual_addition?: boolean;
    allow_deleting_inward_after_fetch?: boolean;
    allow_updating_quantity_after_received?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
 
declare global {
  interface Window {
    CARE_API_URL: string;
    __CARE_PLUGIN_RUNTIME__: {
      meta: {
        [pluginSlug: string]: PlugConfigMeta;
      };
    };
  }
}
