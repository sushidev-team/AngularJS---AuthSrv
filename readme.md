# ROUTER-UI AUTH - AngularJS Service

An AngularJS (1.5) service for adding an authentication service. Based on the idea of [AuthSrv](https://github.com/AMBERSIVE/AngularJS---AuthService) this is a more flexible and robust way to add authentication to router-ui.

### Version
0.0.5.1

### Installation

#### Step 1

```sh
$ bower install ambersive-router-ui-auth
```
#### Step 2
You first have to declare the 'ambersive.routerui.auth' module dependency inside your app module (perhaps inside your app main module).
Please be aware, that you need ambersive.db and ui.router!

```sh
angular.module('app', ['ambersive.routerui.auth']);
```
### Configuration

This module for angularJS requires an api call where the following json-response come back. At least an user id and/or user roles should be provided.
The used DB module is explained [here](https://github.com/AMBERSIVE/AngularJS---DBSrv). For further information about the authentication mechanism while using the DB-Service please visit the documentation there.

```sh

{
  "status":200,
  "data":{
    "roles":["User"]
  }
}

```

### Useage

It is required to define a array of roles which the user should.
Inheritance is possible. You can also override defined roles.

```sh

     angular.module('app', ['ambersive.routerui.auth','ambersive.db','ui.router'])
            .run(function($log){

            })
            .config(['$authenticationSettingsProvider','$stateProvider','$urlRouterProvider','$authenticationSettingsProvider','$dbSettingsProvider',
                        function ($authenticationSettingsProvider,$stateProvider,$urlRouterProvider,$authenticationSettingsProvider,$dbSettingsProvider) {

                            $dbSettingsProvider.setBaseUrl('http://test.dev/AuthService2/demo/');

                            $authenticationSettingsProvider.setApiValue('baseUrl','http://test.dev/AuthService2/demo/');
                            $authenticationSettingsProvider.setApiValue('url','data/response.json');

                            $authenticationSettingsProvider.setValue('redirect401Route','app.error');
                            $authenticationSettingsProvider.setValue('redirect403Route','app.error');

                                $stateProvider
                                   .state('app', {
                                       abstract: true,
                                       data: {
                                            roles: ['User']
                                       },
                                       views: {
                                           '': {
                                               template: '<div ui-view="main"></div>'
                                           }
                                       }
                                   })
                                   .state('app.state1', {
                                            parent: 'app',
                                            url:'/state1',
                                            views: {
                                                'main@app': {
                                                    template: '<div>state 1 - inherited roles from abstract definition</div>'
                                                }
                                            }
                                        })
                                   .state('app.state2', {
                                       parent: 'app',
                                       url:'/state2',
                                       data: {
                                           roles: []
                                       },
                                       views: {
                                           'main@app': {
                                               template: '<div>state 2 - No roles needed</div>'
                                           }
                                       }
                                   })
                                   .state('app.state3', {
                                       parent: 'app',
                                       url:'/state3',
                                       data: {
                                           roles: ['Admin']
                                       },
                                       views: {
                                           'main@app': {
                                               template: '<div>state 3 - Admin as a role</div>'
                                           }
                                       }
                                   })
                                   .state('app.state4', {
                                        parent: 'app',
                                        url:'/state4',
                                        data: {
                                            roles: ['Admin'],
                                            custom404Check:function(rootScope, event, toState, toParams, fromState, fromParams, options){

                                                return true;

                                            }
                                        },
                                        views: {
                                            'main@app': {
                                                template: '<div>state 3 - Admin as a role</div>'
                                            }
                                        }
                                    })
                                   .state('app.error', {
                                       parent: 'app',
                                       url:'/error',
                                       data: {
                                           roles: []
                                       },
                                       views: {
                                           'main@app': {
                                               template: '<div>error</div>'
                                           }
                                       }
                                   });

                            $urlRouterProvider.otherwise('/state1');

                        }])
                       .controller('DemoController',
                               function($scope,$log){

                               }
                       );


```

You can also restrict access to single elements by using the directive "permissions".
The permissions attributes has to be an array of roles.

```sh
<p permissions="permissions">Paragraph for users</p>

```

### Options

#### redirectOnLogged

Addtional to the roles the module offers a simple way to redirect to routes/urls if a user object is provided

Redirect to Route:

```sh

   .state('app.state4', {
       parent: 'app',
       url:'/state4',
       data: {
           roles: [],
           redirectOnLogged:{
               route:'app.state1'
           }
       },
       views: {
           'main@app': {
               template: '<div>state 4 - redirect - route</div>'
           }
       }
   })

```

Redirect to URL:

```sh

   .state('app.state5', {
       parent: 'app',
       url:'/state5',
       data: {
           roles: [],
           redirectOnLogged:{
               url:'http://www.ambersive.com'
           }
       },
       views: {
           'main@app': {
               template: '<div>state 4 - redirect - route</div>'
           }
       }
   })

```
Custom 404 check function:

This function needs to return a boolean value. If true it throws an 404 error

```sh

   .state('app.state5', {
       parent: 'app',
       url:'/state5',
       data: {
           roles: [],
           custom404Check:function(rootScope, event, toState, toParams, fromState, fromParams, options){

               return true;

           }
       },
       views: {
           'main@app': {
               template: '<div>state 4 - redirect - route</div>'
           }
       }
   })

```



### Broadcasts

The module offers a $broadcast if the permission is denied.

```sh

   $scope.$on('$statePermissionDenied',function(event,args){
        alert('error:'+args.code);
   });


```

License
----
MIT