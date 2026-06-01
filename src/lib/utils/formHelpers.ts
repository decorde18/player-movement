import { EntityConfig } from "@/components/entities/types";

/**
 * Injects options into a select field within an EntityConfig.
 * 
 * @param config The base EntityConfig
 * @param fieldKey The key of the field to inject options into
 * @param options The options array to inject
 * @returns A new deep-cloned EntityConfig with the injected options
 */
export function injectOptions(
  config: EntityConfig,
  fieldKey: string,
  options: { label: string; value: string }[]
): EntityConfig {
  const newConfig = { ...config };
  newConfig.form = {
    ...config.form,
    fields: config.form.fields.map((f) => {
      if (f.key === fieldKey) {
        return { ...f, options };
      }
      return f;
    }),
  };
  return newConfig;
}

/**
 * Attaches a creatable nested config and server action to a specific field.
 * 
 * @param config The base EntityConfig
 * @param fieldKey The key of the field to make creatable
 * @param creatableConfig The nested EntityConfig for the new entity
 * @param onCreatableSubmit The server action to call when saving
 * @returns A new deep-cloned EntityConfig
 */
export function attachCreatable(
  config: EntityConfig,
  fieldKey: string,
  creatableConfig: EntityConfig,
  onCreatableSubmit: (data: Record<string, string>) => Promise<{ value: string; label: string }>
): EntityConfig {
  const newConfig = { ...config };
  newConfig.form = {
    ...config.form,
    fields: config.form.fields.map((f) => {
      if (f.key === fieldKey) {
        return {
          ...f,
          creatable: true,
          creatableConfig,
          onCreatableSubmit,
        };
      }
      return f;
    }),
  };
  return newConfig;
}
