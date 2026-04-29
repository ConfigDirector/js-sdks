<template>
  <div>
    <div data-testid="welcome">
      {{ welcomeMessage }}
    </div>
    <div data-testid="status">
      {{ readyStatus }}
    </div>
    <div data-testid="context-id">
      {{ context?.id ?? "none" }}
    </div>
    <button
      data-testid="set-context-btn"
      @click="setUserContext"
    >
      Set Context
    </button>
  </div>
</template>

<script setup lang="ts">
const { value: welcomeMessage } = useConfigDirectorValue(
  "welcome-message",
  "default-message",
);
const { readyStatus } = useConfigDirectorStatus();
const { context, updateContext } = useConfigDirectorContext();

const setUserContext = async () => {
  await updateContext({ id: "test-user-1", name: "Test User" });
};
</script>
