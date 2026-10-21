<template>
  <div class="app">
    <header class="header">
      <picture class="header-logo">
        <source srcset="/ConfigDirector-Logo-DarkMode.svg" media="(prefers-color-scheme: dark)">
        <img src="/ConfigDirector-Logo-LightMode.svg" alt="ConfigDirector" height="32">
      </picture>
      <NavBar />
    </header>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>
