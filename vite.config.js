import {defineConfig} from 'vite';
export default defineConfig({
  server:{host:'0.0.0.0',port:5175,strictPort:true},
  preview:{host:'0.0.0.0',port:5176,strictPort:true},
  build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/utils/BufferGeometryUtils.js']}}}}
});
