/* Software Engineering University: site configuration.
   Safe to publish. NEVER put an API key in this file or anywhere else in the site:
   everything here is downloaded by every visitor.

   aiEndpoint  Leave '' to use the built-in tutor only (default, free, works offline).
               To connect a real AI model, deploy a small server-side function that
               holds the key (see uni/ai-endpoint-example/) and put its https URL here.
   aiLabel     Name shown to students for the connected model, e.g. 'Claude'.            */
window.UNI_CONFIG = {
  aiEndpoint: '',
  aiLabel: '',
};
