export default defineNuxtConfig({
  modules: ['@nuxt/image', '../src/module'],
  devtools: { enabled: true },
  compatibilityDate: '2025-02-14',

  image: {
    domains: ['placekittens.com'],
  },

  ipxCache: {
    maxAge: 10,
    extendThreshold: 5,
  },
});
