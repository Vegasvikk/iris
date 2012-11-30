/*
 * iris
 * https://github.com/iris-js/iris
 *
 * Copyright (c) 2012 Iris
 * Licensed under the New-BSD license.
 */

(function ($, window) {

  var   _cacheVersion,
        _JQ_MIN_VER = 1.5,
        _env = null,
        _log = {"error":true},
        _logPrefix = "",
        _screen = {},
        _screenUrl = {},
        _screenContainer = {},
        _lastScreen = {},
        _prevHash = "",
        _global = {},
        _local = {},
        _locale = null,
        _config = {},
        _lang = {},
        _event = {},
        _includes = {},
        _addOns = {},
        _appBaseUri = "",
        _lastIncludePath,
        _head = $("head").get(0),
        _cache = true,
        _hasConsole,
        _gotoCancelled = false,
        _welcomeCreated = false
    ;
    
    function _welcome (p_jsUrl) {
        
        // CHECK JQ DEPENDENCY
        if( typeof jQuery === "undefined" ) {
            _logError( "jQuery " + _JQ_MIN_VER + "+ previous load required" );
        }
        else if ( $().jquery < _JQ_MIN_VER ) {
            _logError( "jQuery " + $().jquery + " currently loaded, jQuery " + _JQ_MIN_VER + "+ required" );
        }
        
        // CHECK CONSOLE SUPPORT
        _hasConsole = (window.console && window.console.debug && window.console.warn && window.console.error);
        if ( !_hasConsole && window.console && window.console.log ) {
            window.console.log("advanced console is unsupported in this browser");
        }

        _include(p_jsUrl);

        var screenObj = new Screen();
        _includes[p_jsUrl](screenObj);
        screenObj.id = "welcome-screen";
        screenObj.el = {};
        screenObj.uis = [];
        screenObj.con = $(document.body);
        screenObj.fileJs = p_jsUrl;
        screenObj.Create();
        screenObj._awake();
        screenObj.Show();

        _welcomeCreated = true;

        // CHECK HASH SUPPORT
        if ( !("onhashchange" in window) ) {
            _logError("doesn't support the hashchange event");
        }
        else {
            
            if ( document.location.hash ) {
                _onHashChange();
            }
            
            $(window).bind("hashchange", _onHashChange);
        }
    }
    
    function _logOf (p_type) {
        return _log[p_type];
    }
    
    function _L(){
        if ( _hasConsole && window.console.log) {
            window.console.log(_logPrefix, arguments);
        }
    }
    
    function _D(){
        if(_hasConsole && _logOf("debug") ){
            window.console.debug(_logPrefix, arguments);
        }
    }
    
    function _logWarning(){
        if(_hasConsole && _logOf("warning") ){
            window.console.warn(_logPrefix, arguments);
        }
    }
    
    function _logError(){
        if(_hasConsole && _logOf("error") ){
            window.console.error(_logPrefix, arguments);
        }
    }
    
    
    
    function _goto (p_hashUri) {
        _prevHash = document.location.hash;
        document.location.hash = p_hashUri; // Trigger hashchange event, then execute _onHashChange()
    }

    function _onHashChange () {
        
        if ( !_welcomeCreated ) {
            iris.e("You must set the welcome screen using iris.welcome()");
            return false;
        }
        
        iris.event.Notify(iris.event.BEFORE_NAVIGATION);
        
        if ( _gotoCancelled ) {
            _gotoCancelled = false;
            return false;
        }
        
        var prev = _prevHash.split("/"),
            curr = document.location.hash.split("/"),
            prevPath = "",
            currPath = "",
            pathWithoutParams,
            hasRemainingChilds = false,
            i
        ;
        
        // Check if all screen.canSleep() are true
        if ( _prevHash !== "" ) {
            for ( i=0; i<prev.length; i++ ) {
                
                if ( prev[i] !== "" ) {
                    prevPath += prev[i] + "/";
                    pathWithoutParams = _removeURLParams(prevPath);
                    
                    if (_screen.hasOwnProperty(pathWithoutParams) && _screen[pathWithoutParams].canSleep() === false ) {
                        _gotoCancelled = true;
                        document.location.hash = _prevHash;
                        return false;
                    }
                }
            }            
        }
        prevPath = "";
        
        // Hide screens and its childs that are not showed
        if ( prev.length > curr.length ) {
            
            for ( i=0; i<prev.length; i++ ) {
                prevPath += prev[i] + "/";
                
                if ( curr[i] ) {
                    currPath += curr[i] + "/";
                }
                
                if ( hasRemainingChilds || currPath !== prevPath ) {
                    hasRemainingChilds = true;
                    pathWithoutParams = _removeURLParams(prevPath);

                    _screen[pathWithoutParams]._sleep();
                    _screen[pathWithoutParams].hide();
                }
            }
        }
        
        // Show child screens
        prevPath = "";
        currPath = "";
        hasRemainingChilds = false;
        for ( i=0; i<curr.length; i++ ) {
            currPath += curr[i] + "/";
            
            if ( prev[i] ) {
                prevPath += prev[i] + "/";
            }
            
            if ( hasRemainingChilds || currPath !== prevPath ) {
                hasRemainingChilds = true;
                
                pathWithoutParams = _removeURLParams(currPath);
                _ShowScreen(pathWithoutParams, _navGetParams(curr[i]) );
                
            }
        }
        
        _prevHash = _removeLastSlash(currPath);
    }
    
    function _removeURLParams (p_url) {
        return _removeLastSlash(p_url.replace(/\?[^\/]*/, ""));
    }
    
    function _removeLastSlash (p_url) {
        return p_url.replace(/\/$/, "");
    }
    
    function _navGetParams(p_hashPart) {
        var params = {},
            regex = /([\.\w_\-]*)=([^&]*)/g,
            matches = regex.exec(p_hashPart)
        ;
        
        while ( matches ) {
            params[matches[1]] = decodeURIComponent(matches[2]);
            matches = regex.exec(p_hashPart);
        }

        return params;
    }
    
    function _baseUri(p_baseUri){
        if ( p_baseUri !== undefined ) {
            _appBaseUri = p_baseUri;
        }
        else {
            var base = document.getElementsByTagName("base");
            base = base.length > 0 ? base[0].attributes.href.value : "/";
            _appBaseUri = document.location.protocol + "//" + document.location.host + base;
        }
        return _appBaseUri;
    }

    function _ajax (p_settings) {
        return $.ajax(p_settings);
    }
    
    function _ajaxSync (p_uri, p_dataType, f_success, f_error) {
        var ajaxSettings = {
            url: p_uri,
            dataType: p_dataType,
            async: false,
            cache: _cache,
            success : f_success,
            error : f_error
        };
        
        if ( _cache && _cacheVersion !== undefined ) {
            ajaxSettings.data = "_=" + _cacheVersion;
        }
        
        $.ajax(ajaxSettings);
    }
    
    function _setCacheVersion (p_value) {
        _cacheVersion = p_value;
    }
    
    
    function _includeFiles () {
        for ( var f=0,F=arguments.length; f<F; f++ ){
            _include( arguments[f] );
        }
    }

    function _include(p_uiFile) {

        if ( !_includes.hasOwnProperty(p_uiFile) ) {
            _includes[p_uiFile] = true;
            
            var fileUrl = p_uiFile.indexOf("http") === 0 ? p_uiFile: _baseUri() + p_uiFile;
            
            _D("[iris.ui.Include]", fileUrl);
            
            if ( p_uiFile.lastIndexOf(".css") > -1 ) {
                var link  = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = fileUrl;
                _head.appendChild(link);
            }
            else {
                var isHtml = p_uiFile.lastIndexOf(".html") > -1;
                _ajaxSync(
                    fileUrl,
                    (isHtml ? "html" : "text"),
                    function (p_data) {
                        _lastIncludePath = p_uiFile;
                        
                        if ( isHtml ) {
                            _includes[p_uiFile] = _localeParse(p_data);
                        }
                        else {
                            var script = document.createElement("script");
                            script.language = "javascript";
                            script.type = "text/javascript";
                            script.text = p_data;
                            _head.appendChild(script);
                        }
                        
                    },
                    function (p_err) {
                        delete _includes[fileUrl];
                        _logError(p_err.status, "Error loading file '" + fileUrl + "'");
                    }
                );
            }
        }
    }
    
    
    function _configLoad (p_json){
        if ( p_json ) {
            $.extend(_config, p_json);

            _addGlobal( _config.global );

            var currentEnv = _getEnv();
            if ( _config.log ) {
                var logConfig = _config.log[currentEnv];
                var logs = logConfig.split(",");
                for ( var i=0; i < logs.length; i++ ) {
                    _log[ $.trim(logs[i]) ] = true;
                }
            }
            
            _cache = true;
            if ( _config.hasOwnProperty("environments-nocache") ) {
                var envNocache = _config["environments-nocache"].split(",");
                for ( var f=0, F=envNocache.length; f<F; f++ ) {
                    if ( envNocache[f] === currentEnv ) {
                        _cache = false;
                        break;
                    }
                }
            }
            
            _addLocal( _config.local );
        }
        return _config;
    }
    
    function _getEnv (p_env) {
        if ( p_env !== undefined ) {
            _env = p_env;
        }
        else {
            if ( !_env ) {
                _env = _config["environment-default"];
                for (var p in _config.environment ){
                    if ( document.location.href.indexOf( p ) > -1 ) {
                        _env = _config.environment[p];
                        break;
                    }
                }
                if ( !_env ) {
                    _env = "pro";
                }
                _logPrefix = "[" + _env + "]";
            }
            return _env;
        }
    }
    
    //
    // Global
    //
    function _addGlobal(p_hash){
        $.extend(_global, p_hash);
        return _global;
    }

    function _getOrSetGlobal (p_label, p_value){
        if ( p_label && p_value !== undefined ) {
            _global[p_label] = p_value;     
        }
        else if ( p_label ) {
            return _global[p_label];
        }
        else {
            return _global;
        }
    }

    function _global (p_labelOrObject, p_value){
        if ( typeof p_labelOrObject === "object" ) {
            _addGlobal(p_labelOrObject);
        } else {
            _getOrSetGlobal(p_labelOrObject, p_value);
        }
    }


    //
    // Local
    //
    function _addLocal(p_hash){
        $.extend(_local, p_hash);
        return _local;
    }

    function _getOrSetLocal(p_label, p_value){
        if ( p_label && p_value !== undefined ) {
            _local[p_label][_getEnv()] = p_value;     
        }
        else if ( p_label ) {
            return _local[p_label][_getEnv()];
        }
        else  {
            return _local;
        }
    }
    
    function _local (p_labelOrObject, p_value) {
        if ( typeof p_labelOrObject === "object" ) {
            _addLocal(p_labelOrObject);
        } else {
            _getOrSetLocal(p_labelOrObject, p_value);
        }
    }
    
    //
    // EVENT
    //
    function _FindEvent(p_eventName, f_func){
        var events = _event[p_eventName];
        if ( events ) {
            for ( var f=0, F=events.length; f<F; f++ ) {
                if ( events[f] === f_func ) {
                    return f;
                }
            }
        }
        return -1;
    }
    
    function _eventSubscribe(p_eventName, f_func){
        if ( !_event[p_eventName] ) {
            _event[p_eventName] = [];
        }

        var index = _FindEvent( p_eventName, f_func );
        if ( index === -1 ) {
            index = _event[p_eventName].length;
        }

        _event[p_eventName][index] = f_func;
    }
    
    function _eventRemove(p_eventName, f_func){
        var index = _FindEvent(p_eventName, f_func);
        if ( index !== -1 ){
            _event[p_eventName].splice(index,1);
        }
    }

    function _eventNotify(p_eventName, p_data){
        if ( _event[p_eventName] ) {
            var funcs = _event[p_eventName];
            for ( var f=0, F=funcs.length; f<F; f++ ) {
                funcs[f](p_data);
            }
        }
    }
    
    
    
    
    function _GetObjectValue (p_obj, p_label) {
        var value;
        if ( p_label.indexOf(".") > -1 ){
            var labels = p_label.split(".");
            var f,F=labels.length;
            for(f=0; f<F; f++){
                if (p_obj !== undefined ) {
                    p_obj = p_obj[labels[f]];
                }
                else {
                    break;
                }
            }
            value = p_obj;
        }
        else {
            value  = p_obj[p_label];
        }
        return value;
    }
    

    //
    // LANG
    //
    function _localeGet(p_locale) {
        if ( p_locale !== undefined ) {
            _locale = p_locale;
        }
        else {
            return _locale;
        }
    }

    function _localeParse(p_html){
        var html = p_html;
        var matches = html.match(/@@[A-Za-z_\.]+@@/g);
        
        if ( matches ) {
            var f, F = matches.length;
            for ( f=0; f<F; f++ ) {
                html = html.replace(matches[f], _getLang(matches[f].substring(2,matches[f].length-2)));
            }
        }
        return html;
    }

    //
    // LANG
    //
    function _lang (p_label, p_value, p_settings) {
        if ( typeof p_value === "undefined" ) {
            return _getLang(p_label);
        } else if ( typeof p_value === "object" ) {
            _addLang(p_label, p_value);
        } else {
            _loadLang(p_label, p_value, p_settings);
        }
    }

    function _addLang(p_locale, p_data){
        _D("[add lang]", p_locale, p_data);
        
        if ( _locale === null ) {
            _locale = p_locale;
        }
        
        if ( !_lang.hasOwnProperty(p_locale) ) {
            _lang[p_locale] = {};
        }
        
        $.extend(_lang[p_locale], p_data);
    }

    function _getLang (p_label) {
        var value;
        if ( _lang.hasOwnProperty(_locale) ) {
            value = _GetObjectValue(_lang[_locale], p_label);
            if ( value === undefined ) {
                iris.w("Label '" + p_label + "' not found in Locale '" + _locale + "'", _lang[_locale]);
            }
            if ( typeof value === "object" ) {
                iris.w("Label '" + p_label + "' is an object but must be a property in Locale '" + _locale + "'", _lang[_locale]);
            }
        }
        else {
            iris.w("Locale '" + _locale + "' not loaded");
        }
        return ( value ) ? value : "??" + p_label + "??";
    }

    function _loadLang (p_locale, p_uri, p_settings) {
        _D("[iris.lang.LoadFrom]", p_locale, p_uri);
        
        _ajaxSync(
            p_uri,
            "json",
            function (p_data) {
                  _addLang(p_locale, p_data);
                  _D("[iris.lang.LoadFrom] loaded", p_data);

                  if ( p_settings && p_settings.hasOwnProperty("success") ) {
                      p_settings.success(p_locale);
                  }
            },
            function (p_err) {
                  _logError(p_err.status, "Error loading lang file", p_uri);
                  
                  if ( p_settings && p_settings.hasOwnProperty("error") ) {
                      p_settings.error(p_locale);
                  }
            }
        );
    }


    

    
    //
    // ADDON
    //
    function _ApplyAddOn( p_id, p_uis, p_settings ){
        _include(p_id);
        
        var addOn = new AddOn ();
        addOn._components = [];
        addOn.settings =  {};
        
        _addOns[p_id]( addOn );
        addOn.Settings(p_settings);
        addOn.AddAll(p_uis);
        addOn.Create();
        return addOn;
    }

    
    function _CreateAddOn( f_addOn  ){
        _addOns[ _lastIncludePath ] = f_addOn;
    }
    
    //
    // UI
    //
    function _registerUI (f_ui) {
        _includes[_lastIncludePath] = f_ui;
    }
    
    function _InstanceUI (p_$container, p_uiId, p_jsUrl, p_uiSettings, p_templateMode) {
        _include(p_jsUrl);
        
        var uiInstance = new UI();
        _includes[p_jsUrl](uiInstance);
        uiInstance.id = p_uiId;
        uiInstance.el = {};
        uiInstance.con = p_$container;
        uiInstance.uis = [];
        uiInstance.settings = {};
        uiInstance.fileJs = p_jsUrl;
        if ( p_templateMode !== undefined ) {
            uiInstance._tmplMode = p_templateMode;
        }
        
        p_uiSettings = p_uiSettings === undefined ? {} : p_uiSettings;
        var jqToHash = _JqToHash(p_$container);
        
        $.extend(uiInstance.settings, jqToHash, p_uiSettings);

        uiInstance.Create(jqToHash, p_uiSettings);
        
        return uiInstance;
    }

    // @private
    function _JqToHash(p_$obj) {
        var hash = {};
        var attrs = p_$obj.get(0).attributes;
        var label;
        for( var f=0, F=attrs.length; f<F; f++ ) {
            label = attrs[f].name;
            if ( label.indexOf("data-") === 0 ){
                label = label.substr(5);
            }
            hash[label] = attrs[f].value;
        }
        return hash;
    }
    
    
    //
    // SCREEN
    //
    function _registerScreen (f_screen) {
        _includes[_lastIncludePath] = f_screen;
    }
    
    function _instanceScreen (p_screenPath) {
        
        var jsUrl = _screenUrl[p_screenPath];
        _include(jsUrl);
        
        var screenObj = new Screen();
        _includes[jsUrl](screenObj);

        screenObj.id = p_screenPath;
        screenObj.el = {};
        screenObj.uis = [];
        screenObj.con = _screenContainer[p_screenPath];
        screenObj.fileJs = jsUrl;
        screenObj.Create();
        screenObj.hide();
        
        _screen[p_screenPath] = screenObj;
    }
    
    function _DestroyScreen (p_screenPath) {
        if ( _screen.hasOwnProperty(p_screenPath) ) {
            var contextId = _screen[p_screenPath].get().parent().data("screen_context");
            if ( _lastScreen[contextId] === _screen[p_screenPath] ) {
                delete _lastScreen[contextId];
            }
            _screen[p_screenPath]._destroy();
            _screen[p_screenPath].get().remove();
            delete _screen[p_screenPath];
        }
        else {
            iris.w("Error removing the screen \"" + p_screenPath + "\", path not found.");
        }
    }
    
    function _ShowScreen (p_screenPath, p_params) {

        if ( !_screenContainer.hasOwnProperty(p_screenPath) ) {
            _logError( "Screen '" + p_screenPath + "' must be registered with self.screen() before go to" );
        }
        else {
            if ( !_screen.hasOwnProperty(p_screenPath) ) {
                _instanceScreen(p_screenPath);
            }

            var currentScreen = _screen[p_screenPath];
            var contextId = currentScreen.get().parent().data("screen_context");
            if ( _lastScreen.hasOwnProperty(contextId) ) {
                var lastScreen = _lastScreen[contextId];
                lastScreen._sleep();
                lastScreen.hide();
            }
            currentScreen._awake( p_params ? p_params : {} );
            currentScreen.Show();

            _lastScreen[contextId] = currentScreen;
        }
    }

    function _TemplateParse (p_html, p_data, p_htmlUrl) {
        var result = p_html,
            formatLabel,
            value,
            regExp = /##([0-9A-Za-z_\.]+)(?:\|(date|currency)(?:\(([^\)]+)\))*)?##/g,
            matches = regExp.exec(p_html)
        ;

        while ( matches ) {
            value = _GetObjectValue(p_data, matches[1]);
            
            if ( value !== undefined ) {
                formatLabel = matches[2];
                if ( formatLabel ) {
                    switch (formatLabel) {
                        case "date":
                            value = _DateFormat(value, matches[3]);
                            break;
                        case "currency":
                            value = _ParseCurrency(value);
                            break;
                        default:
                            iris.w("Unknow template format label '" + formatLabel + "' in '" + p_htmlUrl + "'");
                    }
                }
            }
            else {
                iris.w("Template param '" + matches[1] + "' in '" + p_htmlUrl + "' not found", p_data);
            }

            result = result.replace(matches[0], value);
            
            matches = regExp.exec(p_html);
        }
        
        return result;
    }
    
    function _ParseCurrency (p_value) {
        var settings = _GetRegionalSetting("currency");
            
        var val = Number(p_value);
        var format = (val >= 0) ? settings.formatPos : settings.formatNeg;
        
        var decimal = val % 1;
        var num = String( Math.abs(val-decimal) );
        
        decimal = String(Math.abs(decimal).toFixed(settings.precision));
        decimal = decimal.substr(2);
        
        for (var i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
            num = num.substring(0, num.length - (4 * i + 3)) + settings.thousand + num.substring(num.length - (4 * i + 3));
        }
        
        return format.replace("n", num + settings.decimal + decimal );
    }
    
    function _DateFormat (p_date, p_format) {
        if ( !p_format ) {
            p_format = _GetRegionalSetting("dateFormat");
        }
        
        if ( typeof p_date !== "object" ) {
            p_date = new Date(Number(p_date));
        }
        
        var dateFormat = "";
        for (var f=0, F=p_format.length; f<F; f++) {
            dateFormat += _DateFormatChar(p_format[f], p_date);
        }
        return dateFormat;
    }
    
    function _GetRegionalSetting (p_label) {
        if ( _Regional.hasOwnProperty(_locale) ) {
            if ( _Regional[_locale].hasOwnProperty(p_label) ) {
                return _Regional[_locale][p_label];
            }
            else {
                iris.e("Regional setting '" + p_label + "' not found for locale '" + _locale + "'");
            }
        }
        else {
            iris.e("Regional for locale '" + _locale + "' not found");
        }
    }
    
    function _LeadingZero (p_number) {
        return (p_number < 10) ? "0" + p_number : p_number;
    }
    
    function _DateFormatChar (p_formatChar, p_date) {
        var regional = _Regional[_locale];
        switch (p_formatChar) {
            case "y":
                return String(p_date.getFullYear()).substring(2);
            case "Y":
                return p_date.getFullYear();
            case "m":
                var m = p_date.getMonth()+1;
                return _LeadingZero(m);
            case "n":
                return p_date.getMonth()+1;
            case "M":
                return regional.monthNames[p_date.getMonth()].substring(0, 3);
            case "b":
                return regional.monthNames[p_date.getMonth()].substring(0, 3).toLowerCase();
            case "F":
                return regional.monthNames[p_date.getMonth()];
            case "d":
                var d = p_date.getDate();
                return _LeadingZero(d);
            case "D":
                return regional.dayNames[p_date.getDay()].substring(0, 3);
            case "l":
                return regional.dayNames[p_date.getDay()];
            case "s":
                var s = p_date.getSeconds();
                return _LeadingZero(s);
            case "i":
                var i = p_date.getMinutes();
                return _LeadingZero(i);
            case "H":
                var h = p_date.getHours();
                return _LeadingZero(h);
            case "h":
                var hour = p_date.getHours();
                hour = (hour % 12) === 0 ? 12 : hour % 12;
                return _LeadingZero(hour);
            case "a":
                return (p_date.getHours() > 12) ? "p.m." : "a.m.";
            case "A":
                return (p_date.getHours() > 12) ? "PM" : "AM";
            case "U":
                return Math.floor(p_date.getTime() * 0.001);
            default:
                return p_formatChar;
        }
    }

    var _Regional = {
         "en-US" : {
            dayNames : ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
            monthNames : ["January","February","March","April","May","June","July","August","September","October","November","December"],
            dateFormat : "m/d/Y h:i:s",
            currency : {
                formatPos : "n",
                formatNeg : "(n)",
                decimal : ".",
                thousand : ",",
                precision : 2
            }
        },
        "es-ES" : {
            dayNames : ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
            monthNames : ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
            dateFormat : "d/m/Y H:i:s",
            currency : {
                formatPos : "n",
                formatNeg : "-n",
                decimal : ",",
                thousand : ".",
                precision : 2
            }
        }
    };

    function _AddRegional (p_locale, p_regional) {
        _Regional[p_locale] = p_regional;
    }
    
    /**
     * @class
     * Provide mechanism to store and retrieve settings values.
     */
    var Settable = function () {
        this.settings = null;
    };
    
    /**
     * Set multiple Component settings.
     * You can access to this values using {@link iris-Settable#Setting}.
     * @function
     * @example
     * 
     * self.Settings({
     *      "min" : 0
     *     ,"label" : "example" 
     * });
     */
    Settable.prototype.Settings = function (p_settings) {
        return $.extend(this.settings, p_settings);
    };

    /**
     * Set or get a single Component setting.
     * @function
     * @example
     * 
     * var label = self.Setting("label"); // Get setting value
     * 
     * self.Setting("label", "example"); // Set setting value
     */
    Settable.prototype.Setting = function (p_label, p_value) {
        if ( p_value === undefined ) {
            if ( !this.settings.hasOwnProperty(p_label) ) {
                iris.w("The setting ", p_label, " is not in ", this.settings, this);
            }
            return this.settings[p_label];
        }
        else {
            this.settings[p_label] = p_value;
        }
    };
    

    var Component = function () {
        
        this.TEMPLATE_APPEND = "append";
        this.TEMPLATE_REPLACE = "replace";
        this.TEMPLATE_PREPEND = "prepend";
        
        this._$tmpl = null;
        this.id = null;
        this.uis = null;
        this.con = null;
        this._sleeping = null;
        this.fileJs = null;
        this.fileTmpl = null;
        this.el = null;
    };
    
    Component.prototype = new Settable();
    
    Component.prototype._sleep = function () {
        for ( var f=0, F=this.uis.length; f < F; f++ ) {
            this.uis[f]._sleep();
        }
        this._sleeping = true;
        this.sleep();
    };
    
    Component.prototype._awake = function (p_params) {
        for ( var f=0, F=this.uis.length; f < F; f++ ) {
            this.uis[f]._awake();
        }
        this._sleeping = false;
        this.awake(p_params);
    };
    
    Component.prototype._destroy = function () {
        if ( !this._sleeping ) {
            this._sleep();
        }

        for ( var f=0, F=this.uis.length; f < F; f++ ) {
            this.uis[f]._destroy();
        }
        this.uis = null;
        this.destroy();
    };

    Component.prototype._tmpl = function (p_htmlUrl, p_params, p_mode) {
        this.fileTmpl = p_htmlUrl;
        
        if ( typeof p_htmlUrl === "undefined" ) {
            this._$tmpl = this.con;
            return this._$tmpl;
        }
        
        iris.include(p_htmlUrl);
        
        var tmplHtml = p_params ? _TemplateParse(_includes[p_htmlUrl], p_params, p_htmlUrl) : _includes[p_htmlUrl];
        var $tmpl = $(tmplHtml);
        
        this._$tmpl = $tmpl;
        if ( $tmpl.size() > 1 ) {
            iris.e("Template '" + p_htmlUrl + "' must have only one root node");
        }
        switch ( p_mode ) {
            case this.TEMPLATE_APPEND:
                this.con.append($tmpl);
                break;
            case this.TEMPLATE_REPLACE:
                this.con.replaceWith($tmpl);
                break;
            case this.TEMPLATE_PREPEND:
                this.con.prepend($tmpl);
                break;
            default:
                iris.e("Unknown template mode '" + p_mode + "'");
        }
        
    };
    
    // Check if the template is set (https://github.com/intelygenz/iris/issues/19)
    Component.prototype._checkTmpl = function () {
        if ( this._$tmpl === null ) {
            iris.e("You must set a template using self.Template() in '" + this.fileJs + "'");
            return undefined;
        }
    };

    Component.prototype.show = function () {
        this._checkTmpl();
        
        this._$tmpl.show();
    };

    Component.prototype.hide = function () {
        this._checkTmpl();
        
        this._$tmpl.hide();
    };

    Component.prototype.get = function(p_id) {
        this._checkTmpl();

        if (p_id) {

          if (!this.el.hasOwnProperty(p_id)) {
            var id = "[data-id=" + p_id + "]", filter = this._$tmpl.filter(id), $element = null;

            if (filter.length > 0) {
              $element = filter;
            } else {
              var find = this._$tmpl.find(id);
              if (find.size() > 0) {
                $element = find;
              }
            }

            if ($element === null) {
              iris.e("[data-id=" + p_id + "] not found in '" + this.fileTmpl + "' used by '" + this.fileJs + "'");
              return undefined;
            } else if ($element.size() > 1) {
              iris.e("[data-id=" + p_id + "] must be unique in '" + this.fileTmpl + "' used by '" + this.fileJs + "'");
              return undefined;
            }

            this.el[p_id] = $element;
          }

          return this.el[p_id];
        }

        return this._$tmpl;
    };

    Component.prototype.ui = function (p_id, p_jsUrl, p_uiSettings, p_templateMode) {
        var $container = this.get(p_id);
        if ( $container.size() === 1 ) {
            var uiInstance = _InstanceUI($container, $container.data("id"), p_jsUrl, p_uiSettings, p_templateMode);
            this.uis[this.uis.length] = uiInstance;
            return uiInstance;
        }
    };
    

    Component.prototype.destroyUI = function (p_ui) {
        for (var f=0, F=this.uis.length; f < F; f++) {
            if (this.uis[f] === p_ui) {
                this.uis.splice(f, 1);
                p_ui._destroy();
                p_ui.get().remove();
                break;
            }
        }
    };

    Component.prototype.destroyUIs = function (p_idOrJq) {
        var contSelector = typeof p_idOrJq === "string" ? "[data-id=" + p_idOrJq + "]" : p_idOrJq.selector;
        var ui;
        for (var f=0, F=this.uis.length; f < F; f++) {
            ui = this.uis[f];
            
            if (ui.con.selector === contSelector) {
                this.uis.splice(f--, 1);
                F--;
                
                ui._destroy();
                ui.get().remove();
            }
        }
    };

    Component.prototype.container = function () {
        return this.con;
    };
    
    //
    // To override functions
    //
    Component.prototype.create = function () {};

    Component.prototype.awake = function () {};

    Component.prototype.canSleep = function () {
        return true;
    };

    Component.prototype.sleep = function () {};
    
    Component.prototype.destroy = function () {};
    


    //
    // ADDON
    //
    var AddOn = function () {
        this._components = null;
    };
    
    AddOn.prototype = new Settable();
        
    /**
     * Add a array of UIs to the AddOn.
     * It is called automatically from {@link iris.ApplyAddOn}.
     * @param p_uis {Array} Array of UIs
     * @function
     */
    AddOn.prototype.AddAll = function (p_uis) {
        for (var f=0, F=p_uis.length; f<F; f++) {
            this.Add( p_uis[f] );
        }
    };
    
    /**
     * Add a UI to the AddOn.
     * @param p_uis {UI} UI instance
     * @function
     */
    AddOn.prototype.Add = function (p_ui) {
        if ( this.hasOwnProperty("UIAddOn") ) {
            this.UIAddOn( p_ui );
        }
        this._components[this._components.length] = p_ui;
    };
    
    /**
     * Remove a UI from the AddOn.
     * @param p_uis {UI} UI instance
     * @function
     */
    AddOn.prototype.Remove = function (p_ui) {
        var ui;
        for (var f=0, F=this._components.length; f<F; f++) {
            ui = this._components[f];
            if ( ui === p_ui ) {
                this._components.splice(f, 1);
            }
        }
    };

    /**
     * Get a registered UI from the AddOn.
     * The UI must be previosly registered using {@link iris.ApplyAddOn},
     * {@link iris-AddOn#AddAll} or {@link iris-AddOn#Add}
     * @param p_idx {integer} UI instance position
     * @function
     */
    AddOn.prototype.Get = function (p_idx) {
        return this._components[p_idx];
    };

    /**
     * The number of UI Components registered.
     * @function
     */
    AddOn.prototype.Size = function () {
        return this._components.length;
    };
    
    // To override
    
    /**
     * Called automatically when all UIs have been added.
     * Function to override.
     * @function
     */
    AddOn.prototype.Create = function () {};
    

    //
    // UI
    //
    var UI = function () {
        this._tmplMode = "replace";
    };
    
    UI.prototype = new Component();

    UI.prototype.tmplMode = function (p_mode) {
        this._tmplMode = p_mode;
    };

    UI.prototype.tmpl = function (p_htmlUrl, p_params) {
        this._tmpl(p_htmlUrl, p_params, this._tmplMode);
    };
        

    //
    // SCREEN
    //
    var Screen = function () {};
    
    Screen.prototype = new Component();

    Screen.prototype.tmpl = function (p_htmlUrl, p_params) {
        this._tmpl(p_htmlUrl, p_params, this.TEMPLATE_APPEND);
    };

    Screen.prototype.screen = function (p_containerId, p_screenPath, p_jsUrl) {
        var $cont = this.get(p_containerId);
        
        if ( $cont.data("screen_context") === undefined ) {
            
            // Set a unique screen context id to the screen container
            // like: #path/to/screen|containerid
            $cont.data("screen_context", this.id + "|" + p_containerId);
        }

        _screenUrl[p_screenPath] = p_jsUrl;
        _screenContainer[p_screenPath] = $cont;
    };


    var iris = {
        config : _configLoad,
        env : _getEnv,
        global : _global,
        local : _local,

        lang : _lang,
        locale : _localeGet,

        l : _L,
        d : _D,
        w : _logWarning,
        e : _logError,

        BEFORE_NAVIGATION : "iris_before_navigation",

        notify : _eventNotify,
        on : _eventSubscribe,
        off : _eventRemove,

        baseUri : _baseUri,
        ajax : _ajax,
        cacheVersion : _setCacheVersion,

        include : _includeFiles,
        screen : _registerScreen,
        ui :  _registerUI,
        
        regional : _AddRegional,
        welcome : _welcome,
        goto : _goto,

        destroyScreen : _DestroyScreen,

        date : _DateFormat,
        currency : _ParseCurrency,

        addOn : _CreateAddOn,
        applyAddOn : _ApplyAddOn

    };

    window.iris = iris;

})(jQuery, window);
