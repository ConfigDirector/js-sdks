<script setup lang="ts">
import type { Ref } from "vue";

const { updateContext } = useConfigDirectorContext();

const userId = ref("");
const userName = ref("");
const userRole = ref("");
const savedVisible = ref(false);
const clearedVisible = ref(false);

const flash = (visible: Ref<boolean>) => {
  visible.value = true;
  setTimeout(() => (visible.value = false), 2200);
};

const save = async () => {
  await updateContext({
    id: userId.value || undefined,
    name: userName.value || undefined,
    traits: userRole.value ? { role: userRole.value } : undefined,
  });
  flash(savedVisible);
};

const clear = async () => {
  userId.value = "";
  userName.value = "";
  userRole.value = "";
  await updateContext({});
  flash(clearedVisible);
};
</script>

<template>
  <div class="page">
    <h2 class="section-title">Context</h2>
    <p class="description">
      Configure the context sent to ConfigDirector when evaluating feature flags.
    </p>
    <form @submit.prevent="save">
      <div class="field-group">
        <label class="label" for="user-id">User ID</label>
        <input id="user-id" v-model="userId" class="input" type="text" placeholder="e.g. user-123" autocomplete="off">
      </div>
      <div class="field-group">
        <label class="label" for="user-name">User Name</label>
        <input id="user-name" v-model="userName" class="input" type="text" placeholder="e.g. Jane Smith" autocomplete="off">
      </div>
      <div class="field-group">
        <label class="label" for="user-role">User Role</label>
        <input id="user-role" v-model="userRole" class="input" type="text" placeholder="e.g. admin, viewer, editor" autocomplete="off">
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn btn-secondary" type="button" @click="clear">Clear</button>
      </div>
      <div class="confirmation-area">
        <span class="confirmation-msg msg-green" :class="{ hidden: !savedVisible }">Context saved</span>
        <span class="confirmation-msg msg-gray" :class="{ hidden: !clearedVisible }">Context cleared</span>
      </div>
    </form>
  </div>
</template>
