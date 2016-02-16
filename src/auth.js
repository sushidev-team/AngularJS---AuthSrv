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
                refreshTime:60
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
                        error401Url:values.redirect401Url,
                        error403Url:values.redirect403Url,
                        redirectOnError:values.redirectOnError,
                        refreshTime:values.refreshTime
                    };
                }
            });

        }
    ]);

    angular.module('ambersive.routerui.auth').config(['$urlRouterProvider','$authenticationSettingsProvider','$dbSettingsProvider',
        function($urlRouterProvider,$authenticationSettingsProvider,$dbSettingsProvider) {

            $urlRouterProvider.deferIntercept();

        }
    ]);

    angular.module('ambersive.routerui.auth').run(['$rootScope','$urlRouter','$state','$log','Auth','$authenticationSettings','DB',
        function($rootScope,$urlRouter,$state,$log,Auth,$authenticationSettings,DB){

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
                            var redirectSettings = toState.data.redirectOnLogged;

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

            $rootScope.$on('$stateChangeSuccess',
                function(event, toState, toParams, fromState, fromParams, options){

                    // TODO:

                }
            );

            $rootScope.$on('$stateNotFound',
                function(event, toState, toParams, fromState, fromParams, options){

                    // TODO:

                }
            );

            $rootScope.$on('$stateChangeError',
                function(event, toState, toParams, fromState, fromParams){

                    // TODO:

                }
            );

            $rootScope.$on('$viewContentLoaded',
                function(event, viewConfig){

                    // TODO:

                }
            );

        }
    ]);

    angular.module('ambersive.routerui.auth').factory('Auth',['$q','DB','$timeout','$log','$state','$authenticationSettings','$rootScope',
        function($q,DB,$timeout,$log,$state,$authenticationSettings,$rootScope){

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
                $rootScope.$broadcast('$stateAuthenticationUser',{user:User});
                return User;
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

                var redirectFN = function(code,route){
                    if($authenticationSettings.redirectOnError === true) {
                        if (route !== undefined && route !== '') {
                            $state.go(route);
                        } else {
                            $log.warn('ambersive.routerui.auth: please define a route for ' + code + ' errors');
                        }
                    }
                };

                switch(errorCode){

                    case 403:
                        var route403 = $authenticationSettings.error403Route;
                        redirectFN(403,route403);
                        $rootScope.$broadcast('$statePermissionDenied',{code:errorCode});
                        break;

                    default: // Default it is a 401 Error
                        var route401 = $authenticationSettings.error401Route;
                        redirectFN(401,route401);
                        $rootScope.$broadcast('$statePermissionDenied',{code:errorCode});
                        break;

                }

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

            Auth.check = function(toState,toParams,fromState,fromParams,options){

                var deferred = $q.defer(),
                    allow    = false,
                    neededRoles = [];

                /**
                 * Call the promise
                 */

                var callPromise = function(){
                    deferred.resolve(allow);
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

                        $rootScope.$broadcast('$stateAuthenticationUser',{user:User});

                        deferred.resolve();

                    }, function(result){

                        User = {};

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

            return Auth;

        }
    ]);

})(window, document, undefined);