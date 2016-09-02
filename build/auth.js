/**
 * Authentication Service for router-ui for AngularJS
 * @version v0.0.1
 * @link http://www.ambersive.com
 * @licence MIT License, http://www.opensource.org/licenses/MIT
 */

(function(window, document, undefined) {

    'use strict';

    angular.module('ambersive.routerui.auth',['ambersive.db','ui.router']);

    angular.module('ambersive.routerui.auth').provider('$authenticationSettings',[
        function(){

            var values = {
                api:{
                    baseUrl :'',
                    url     :'',
                    except  :['getById','delete','update','create']
                },
                redirectOnError:true,
                redirect401Route:'',
                redirect401Url:'',
                redirect403Route:'',
                redirect403Url:'',
                redirect404Route:'',
                redirect404Url:'',
                redirect500Route:'',
                redirect500Url:'',
                refreshTime:60,
                tokenUseage:true
            };

            return({
                setValue: function (name,value) {
                    if(values[name] === undefined){return;}
                    if(name === 'api'){return;}
                    values[name] = value;
                },
                setApiValue: function(name,value){
                    if(values.api[name] === undefined){return;}
                    values.api[name] = value;
                },
                $get: function () {
                    return {
                        api:values.api,
                        error401Route:values.redirect401Route,
                        error403Route:values.redirect403Route,
                        error404Route:values.redirect404Route,
                        error500Route:values.redirect500Route,
                        error401Url:values.redirect401Url,
                        error403Url:values.redirect403Url,
                        error404Url:values.redirect404Url,
                        error500Url:values.redirect500Url,
                        redirectOnError:values.redirectOnError,
                        refreshTime:values.refreshTime,
                        tokenUseage:values.tokenUseage
                    };
                }
            });

        }
    ]);

    angular.module('ambersive.routerui.auth').config(['AuthProvider','$urlRouterProvider','$authenticationSettingsProvider','$dbSettingsProvider',
        function(AuthProvider,$urlRouterProvider,$authenticationSettingsProvider,$dbSettingsProvider) {

            $urlRouterProvider.deferIntercept();

            $urlRouterProvider.otherwise(function($rootScope, $location){
                AuthProvider.$get().onError(404);
            });

        }
    ]);

    angular.module('ambersive.routerui.auth').directive('permissions',['$compile','$animate','Auth',
        function($compile,$animate,Auth) {

            var directive = {};

            directive.restrict      = 'A';
            directive.transclude    = 'element';

            directive.scope         = {
                permissions:'='
            };

            directive.controller = ['Auth','$scope','$rootScope',
                function(Auth,$scope,$rootScope){

                    var permissions = $scope.permissions,
                        User        = Auth.getUser();

                    $scope.display = true;

                    $scope.user  = User;

                    $scope.check = function(){

                        var allow = true;

                        if(permissions.length > 0){

                            allow = $scope.permissions.some(function(permission){
                               return (User.roles !== undefined && User.roles.indexOf(permission) > -1);
                            });
                        }

                        return allow;

                    };

                    /**
                     * Broadcasts
                     */

                    $rootScope.$on('$stateAuthenticationUser',function(event,args){
                        if(args.user !== undefined){
                            User = args.user;
                            $scope.user = User;
                        }

                        $scope.check();

                    });

                }
            ];

            directive.link = function($scope, $element, $attr, ctrl, $transclude) {
                var block, childScope, previousElements;

                function getBlockNodes(nodes) {
                    var node = nodes[0];
                    var endNode = nodes[nodes.length - 1];
                    var blockNodes;

                    for (var i = 1; node !== endNode && (node = node.nextSibling); i++) {
                        if (blockNodes || nodes[i] !== node) {
                            if (!blockNodes) {
                                blockNodes = jqLite(slice.call(nodes, 0, i));
                            }
                            blockNodes.push(node);
                        }
                    }

                    return blockNodes || nodes;
                }


                $scope.$watch('user',function(value){

                    var allow = $scope.check();

                    if (!childScope && allow === true) {
                        $transclude(function(clone, newScope) {
                            childScope = newScope;
                            clone[clone.length++] = document.createComment(' end ngIf: ' + $attr.ngIf + ' ');
                            block = {
                                clone: clone
                            };
                            $animate.enter(clone, $element.parent(), $element);
                        });

                    } else {

                        if (previousElements) {
                            previousElements.remove();
                            previousElements = null;
                        }
                        if (childScope) {
                            childScope.$destroy();
                            childScope = null;
                        }

                        if (block) {
                            previousElements = getBlockNodes(block.clone);
                            $animate.leave(previousElements).then(function() {
                                previousElements = null;
                            });
                            block = null;
                        }
                    }
                });
            };

            return directive;

        }
    ]);

    angular.module('ambersive.routerui.auth').run(['$rootScope','$urlRouter','$state','$log','Auth','$authenticationSettings','DB','$dbSettings',
        function($rootScope,$urlRouter,$state,$log,Auth,$authenticationSettings,DB,$dbSettings){

            DB({'name':'Auth','baseUrl':$authenticationSettings.api.baseUrl,'url':$authenticationSettings.api.url,except:$authenticationSettings.api.except});

            /**
             * Broadcasts provided by router ui
             */

            $rootScope.$on('$locationChangeSuccess',
                function(event, url) {

                //$urlRouter.sync();
 
            });

            $rootScope.$on('$stateChangeStart',
                function(event, toState, toParams, fromState, fromParams, options){

                    var registerEntry   = Auth.checkRegister(toState.name),
                        refreshTime     = $authenticationSettings.refreshTime,
                        User        = {},
                        UserLogged  = false;

                    /**
                     * Check if the current state offers a redirect on logged definition
                     */

                    var checkRedirectFN = function(){
                        if(UserLogged === true){

                            var redirectSettings         = toState.data.redirectOnLogged;
                            var custom404Check           = toState.data.custom404Check;
                            var customCheckAbort404      = false;

                            if(custom404Check !== undefined){

                                customCheckAbort404 = custom404Check($rootScope, event, toState, toParams, fromState, fromParams, options);

                                if(customCheckAbort404 === true){

                                    return Auth.onError(404,event);

                                }

                            }

                            if(redirectSettings !== undefined){

                                if(redirectSettings.url !== undefined){
                                    window.location.href = redirectSettings.url;
                                    event.preventDefault();
                                }

                                if(redirectSettings.route !== undefined){
                                    $state.go(redirectSettings.route);
                                    event.preventDefault();
                                }

                            }

                        }
                    };

                    /**
                     * Run the checking behavior
                     */

                    if(registerEntry === undefined || registerEntry.allow === undefined || Auth.preCheck(toState.name) === false) {

                        /**
                         * No entry in the $state register
                         * Execute the check
                         */

                        Auth.register(toState.name,true);

                        Auth.check(toState,toParams,fromState,fromParams,options).then(function (allow) {

                            Auth.register(toState.name,allow);

                            User = Auth.getUser();

                            if(User.id !== undefined || User.roles !== undefined){
                                UserLogged = true;
                            }

                            /**
                             * Action handling
                             */

                            if (allow === true) {

                               checkRedirectFN();

                               $state.go(toState,toParams,options);

                            }
                            else if(allow === false && UserLogged === true){
                                Auth.onError(403,event);
                            }
                            else {
                                Auth.onError(401,event);
                            }

                        });

                        event.preventDefault();

                    } else {

                        User = Auth.getUser();
                        if(User.id !== undefined || User.roles !== undefined){
                            UserLogged = true;
                        }

                        if(registerEntry.allow === false && UserLogged === true){

                            Auth.onError(403,event);

                        } else if(registerEntry.allow === false && UserLogged === false){

                            Auth.onError(401,event);

                        } else if(registerEntry.allow === true){

                            checkRedirectFN();

                        }

                    }

                }
            );

            $rootScope.$on('$stateNotFound',
                function(event, toState, toParams, fromState, fromParams, options){

                    Auth.onError(404,event);

                }
            );

            $rootScope.$on('$stateChangeError',
                function(event, toState, toParams, fromState, fromParams){

                    Auth.onError(500,event);

                }
            );

        }
    ]);

    angular.module('ambersive.routerui.auth').factory('Auth',['$q','DB','$timeout','$window','$log','$state','$stateParams','$authenticationSettings','$dbSettings','$rootScope',
        function($q,DB,$timeout,$window,$log,$state,$stateParams,$authenticationSettings,$dbSettings,$rootScope){

            var Auth            = {},
                Helper          = {},
                Register        = {},
                RegisterEntry   = function(){
                    return {
                        'timestamp':0,
                        'allow':false,
                        'roles':[]
                    };
                },
                User            = {};

            if (!Date.now) {
                Date.now = function() { return new Date().getTime(); };
            }

            Helper.getTimestamp = function(){
                var timestamp = Math.floor(Date.now() / 1000);
                return timestamp;
            };

            Helper.compare = function(arr1,arr2){
                return arr1.filter(function(n) {
                    return arr2.indexOf(n) != -1;
                });
            };

            /**
             * User
             */

            Auth.getUser = function(){

                var storageName = $dbSettings.storageName,
                    tokenUseage = $dbSettings.tokenUseage,
                    tokenData   = null,
                    UserData    = {};

                if(tokenUseage === true) {

                    if (typeof(Storage) !== "undefined") {
                        tokenData = localStorage.getItem(storageName);
                    } else {
                        $log.warn('ambersive.db: this browser doesn\'t support localStorage');
                    }

                    if (tokenData !== null) {
                        UserData = User;
                    } else {
                        User = {};
                        UserData = User;
                    }

                } else {
                    UserData = User;
                }

                return UserData;

            };

            Auth.setUser = function(user){
                User = user;
                $rootScope.$broadcast('$stateAuthenticationUser',{user:User});
            };

            Auth.resetUser = function(){

                var storageName = $dbSettings.storageName;

                if (typeof(Storage) !== "undefined") {
                    localStorage.setItem(storageName,null);
                } else {
                    $log.warn('ambersive.db: this browser doesn\'t support localStorage');
                }

                User = {};

                Auth.reCheck();

                $rootScope.$broadcast('$stateAuthenticationUser',{user:User});

            };

            Auth.hasRole = function(role){

                var hasRole = false;

                if(User.roles !== undefined){
                    hasRole = (User.roles.indexOf(role) > -1);
                }

                return hasRole;

            };

            Auth.isAuthenticated = function(){
                var user = Auth.getUser();
                if(user.id !== undefined){
                    return true;
                }
                return false;
            };

            /**
             * Roles
             */

            Auth.getRoles = function(){
                var roles = [];
                if(User !== undefined && User.roles !== undefined){
                    roles = User.roles;
                }
                return roles;
            };

            Auth.checkRole = function(role){

                var userRoles   = Auth.getRoles(),
                    hasRole     = false;

                if(userRoles.indexOf(role) > -1){
                    hasRole = true;
                }

                return hasRole;

            };

            /**
             * Error Handling
             */

            Auth.onError = function(errorCode,event){

                if(errorCode === undefined){
                    $log.warn('ambersive.routerui.auth: please define a error code for error handling');
                    return;
                }

                var handleError = function(code){

                    var url     = $authenticationSettings['error'+code+'Url'],
                        route   = $authenticationSettings['error'+code+'Route'];

                    if(url !== undefined && url !== ''){

                        $window.location.href = url;
                        return;

                    } else {

                        if($authenticationSettings.redirectOnError === true) {
                            if (route !== undefined && route !== '') {
                                $state.go(route);
                            } else {
                                $log.warn('ambersive.routerui.auth: please define a route for ' + code + ' errors');
                            }
                        }

                    }

                };

                switch(errorCode){
                    case 401:
                    case 403:
                        handleError(errorCode);
                        $rootScope.$broadcast('$statePermissionDenied',{code:errorCode});
                        break;
                    default:
                        handleError(errorCode);
                        break;
                }

                if(event === undefined){ return; }
                event.preventDefault();

            };

            /**
             * State register
             */

            Auth.clearRegister = function(){
                Register = {};
                return Register;
            };

            Auth.getRegister = function(){
              return Register;
            };

            Auth.getRegisterEntry = function(stateName){
              if(Register[stateName] === undefined){

              } else {
                  return Register[stateName];
              }
            };

            Auth.checkRegister = function(stateName,bAllow){
                if(bAllow === undefined){
                    bAllow = true;
                }
                var registerEntry = Auth.getRegisterEntry(stateName);
                return registerEntry;
            };

            Auth.register = function(stateName,allow,timestamp){

                var entry = new RegisterEntry();

                if(timestamp === undefined){
                    timestamp = Helper.getTimestamp();
                }

                entry.timestamp = timestamp;
                entry.allow = allow;
                entry.roles = $state.get(stateName).data.roles;

                Register[stateName] = entry;

                return entry;

            };

            Auth.preCheck = function(stateName){
                var success         = false,
                    stateInRegister = Register[stateName],
                    refreshTime     = $authenticationSettings.refreshTime;

                if(stateInRegister !== undefined){

                    if(refreshTime === undefined){
                        refreshTime = 0;
                    }

                    var timestamp = stateInRegister.timestamp+refreshTime;
                    if(Helper.getTimestamp() <= timestamp){
                        success = true;
                    }

                }

                return success;
            };

            Auth.reCheck = function(){
                Auth.check($state,$stateParams);
            };

            Auth.check = function(toState,toParams,fromState,fromParams,options){

                var deferred = $q.defer(),
                    allow    = false,
                    neededRoles = [];

                /**
                 * Call the promise
                 */

                var callPromise = function(b){
                    deferred.resolve(b);
                };

                /**
                 * Check User has the route specific role
                 */

                var isInNeededRole = function(){
                    var isInRole = false;

                    if(neededRoles.length > 0){
                        isInRole = neededRoles.some(Auth.checkRole);
                    } else {
                        isInRole = true;
                    }

                    return isInRole;
                };

                /**
                 *  Default routine
                 */

                Auth.callAPI(toState).then(function() {

                    if (toState !== undefined && toState.data !== undefined && toState.data.roles !== undefined && angular.isArray(toState.data.roles)) {
                        neededRoles = neededRoles.concat(toState.data.roles);
                    }

                    allow = isInNeededRole();

                    callPromise(allow);

                });

                return deferred.promise;

            };

            Auth.callAPI = function(toState){

                var deferred    = $q.defer(),
                    baseUrl     = $authenticationSettings.api.baseUrl,
                    url         = $authenticationSettings.api.url;

                if(baseUrl !== undefined) {

                    /**
                     * Request the api
                     */

                    DB('Auth').get().then(function (result) {

                        if (result.status === 200) {
                            User = result.data;
                        }

                        $rootScope.user = User;
                        $rootScope.$broadcast('$stateAuthenticationUser',{user:User});

                        deferred.resolve();

                    }, function(result){

                        User = {};

                        $rootScope.user = User;
                        $rootScope.$broadcast('$stateAuthenticationUser',{user:User});

                        deferred.resolve();

                    });

                } else {

                    /**
                     * No api request
                     */

                    deferred.resolve();
                }

                return deferred.promise;
            };

            $rootScope.$on('$stateAuthenticationUser',function(event,args){
                if(args.user !== undefined){
                    User = args.user;
                }
            });

            return Auth;

        }
    ]);

})(window, document, undefined);