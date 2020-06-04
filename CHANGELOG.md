# Change Log (@egodigital/express-controllers)

## 7.0.0

* !!! BREAKING CHANGES !!!
  * add `allowDefaultImports` to [IInitControllersOptions](https://egodigital.github.io/express-controllers/interfaces/_index_.iinitcontrollersoptions.html) interface, which is `(true)` by default
* mininum requirement is [Node 12+](https://nodejs.org/dist/latest-v12.x/docs/api/) now
* code build in [strict mode](https://www.typescriptlang.org/docs/handbook/compiler-options.html) now

## 6.1.4

* fix `minimist < 0.2.1` security issue

## 6.1.3

* add `node >= 10.0.0` as minimum requirement to package.json/.npmrc

## 6.1.2

* update README.md to fix issue [#2](https://github.com/egodigital/express-controllers/issues/2)

## 6.1.0

* implemented "after-ware", handlers, which are invoked after a controller method call

## 6.0.0

* added [filter](https://egodigital.github.io/express-controllers/interfaces/_index_.initcontrollersoptions.html#filter) property
* changed default value of [files](https://egodigital.github.io/express-controllers/interfaces/_index_.initcontrollersoptions.html#files) property
* updated to `fast-glob@^3.1.1`

## 5.4.0

* updated to `swagger-ui-express@^4.1.3`

## 5.3.0

* added `security` property to [InitControllersSwaggerDocumentOptions](https://egodigital.github.io/express-controllers/interfaces/_swagger_.initcontrollersswaggerdocumentoptions.html) interface
* updated to `swagger-ui-express@^4.1.2`

## 5.2.0

* added `serializeForJSON()` function
* added `events` with `onControllerCreated` to [InitControllersOptions](https://egodigital.github.io/express-controllers/interfaces/_index_.initcontrollersoptions.html) interface

## 5.1.1

* added `limit` property to [ControllerRouteWithBodyOptions](https://egodigital.github.io/express-controllers/interfaces/_index_.controllerroutewithbodyoptions.html) interface
* added `limit` property to [ObjectValidatorOptions](https://egodigital.github.io/express-controllers/interfaces/_index_.objectvalidatoroptions.html) interface

## 5.0.2

* `@` character prefixes in directory paths, will be interpreted as `:` route parameters prefixes now
* bug fixes

## 4.7.0

* can define [response serializer](https://egodigital.github.io/express-controllers/modules/_index_.html#responseserializer) as global default via `setResponseSerializer()` function now
* code cleanups and improvements

## 4.6.0

* added `SwaggerPathDefinitionUpdaterContext` to [SwaggerPathDefinitionUpdaterContext](https://egodigital.github.io/express-controllers/interfaces/_swagger_.swaggerpathdefinitionupdatercontext.html) interface

## 4.5.1

* can define optional `__updateSwaggerPath` method in [controller](https://egodigital.github.io/express-controllers/interfaces/_index_.controller.html) now

## 4.4.2

* improvements
* bug fixes

## 4.3.0

* improvements

## 4.2.1

* fixes
* improvements

## 4.1.5

* bug fixes

## 4.0.3

* implemented `@Swagger` decorator
* bug fixes
* code cleanups and improvements

## 3.1.0

* code improvements

## 3.0.1

* FIX: failed authorization returns `403` instead of `401` by default

## 3.0.0

* added authorization feature with `@Authorize` decorator
* updated to `lodash@^4.17.14`

## 2.1.0

* updated to `express@^4.17.1`
* bugfixes

## 2.0.0

* code is build for [Node.js 10+](https://nodejs.org/dist/latest-v10.x/docs/api/) now
* set compiler flags and libs to `es2017`
* updated to `express@^4.17.0`
* updated to `fast-glob@^2.2.7`

## 1.2.0

* added `serializer` property to [ControllerRouteOptions](https://egodigital.github.io/express-controllers/interfaces/_index_.controllerrouteoptions.html) interface

## 1.1.1

* (bug)fixes

## 1.0.8

* initial release
