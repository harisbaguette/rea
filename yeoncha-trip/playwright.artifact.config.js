import config from './playwright.config.js';
export default {
  ...config,
  use: {...config.use,baseURL:'http://127.0.0.1:4186'},
  webServer: {command:'npm run preview',url:'http://127.0.0.1:4186',env:{PORT:'4186'},reuseExistingServer:true},
};
