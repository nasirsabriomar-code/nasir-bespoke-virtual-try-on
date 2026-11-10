// Import first: clears deployment/shell image tuning so provider tests see code defaults.
// ES modules evaluate imports in order, so this runs before lib/try-on-handler resolves its config.
for (const key of ["IMAGE_MODEL", "IMAGE_QUALITY", "IMAGE_CANVAS_PROFILE", "IMAGE_COMPLEXITY", "FABRIC_TREATMENT_DEFAULT"]) delete process.env[key];
export {};
