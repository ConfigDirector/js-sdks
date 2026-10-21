<template>
  <div class="page">
    <h2 class="section-title">Feature Flags</h2>
    <ConfigCard config-key="temporary-feature-flag" :default-value="true" />
    <ConfigCard config-key="permanent-kill-switch" :default-value="false" />
    <ConfigCard config-key="integer-config" :default-value="10" />
    <ConfigCard config-key="day-of-the-week-config" default-value="Friday" />
    <ConfigCard config-key="json-value-config" :default-value="{}" />
  </div>
</template>
