<script setup lang="ts">
const props = defineProps<{ configKey: string; defaultValue: boolean | number | string | object }>();

const { value } = useConfigDirectorValue(props.configKey, props.defaultValue);

// typeof catches objects, arrays, and null (typeof null === "object")
const isJson = computed(() => typeof value.value === "object");

const badgeClass = computed(() => {
  if (typeof value.value === "boolean") return value.value ? "badge badge-on" : "badge badge-off";
  return "badge badge-val";
});

const badgeText = computed(() => {
  if (typeof value.value === "boolean") return value.value ? "ON" : "OFF";
  return String(value.value);
});
</script>

<template>
  <div :class="isJson ? 'config-card config-card-json' : 'config-card'" :data-config-key="configKey">
    <div class="config-info">
      <div class="config-name">{{ configKey }}</div>
      <div class="config-key">{{ configKey }}</div>
    </div>
    <pre v-if="isJson" class="config-json">{{ JSON.stringify(value, null, 2) }}</pre>
    <div v-else :class="badgeClass">{{ badgeText }}</div>
  </div>
</template>
