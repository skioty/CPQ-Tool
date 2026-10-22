import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { sessionHeaders } from './navigation/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([sessionHeaders])),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
