import {
  withNativeFederation,
  fromPackageJson,
} from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'mfe-gestion',

  exposes: {
    './routes': './src/app/rutas.ts',
  },

  //shareScope: autoShareScope({level: 'minor'}),

  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    build: 'package',
  })
    .patch(['@angular/*'], { includeSecondaries: { keepAll: true } })
    .get(),

  //sharedMappings: mappingsFromWorkspace({ singleton: true }).filter(['@my-org/*']).get(),

  skip: [
    'rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket',
    // @angular/animations no está instalado
    '@angular/platform-browser/animations', '@angular/platform-browser/animations/async',
  ],

  // Please read our docs about configuring native federation:
  // https://native-federation.com/docs/v4/angular-adapter/configuration/

  features: {
    denseChunking: true,
    denseExternals: true,
    strictImports: false,
  },
});
