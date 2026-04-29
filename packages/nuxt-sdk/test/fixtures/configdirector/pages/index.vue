<template>
  <div>
    <div data-testid="welcome">
      {{ welcomeMessage }}
    </div>
    <div data-testid="feature-enabled">
      {{ String(featureEnabled) }}
    </div>
    <div data-testid="item-count">
      {{ String(itemCount) }}
    </div>
    <div data-testid="status">
      {{ readyStatus }}
    </div>
    <div data-testid="loading">
      {{ loading ? "loading" : "done" }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { value: welcomeMessage } = useConfigDirectorValue(
  "welcome-message",
  "default-message",
);
const { value: featureEnabled } = useConfigDirectorValue(
  "feature-enabled",
  false,
);
const { value: itemCount } = useConfigDirectorValue("item-count", 0);
const { readyStatus, loading } = useConfigDirectorStatus();
</script>
