var seqNo = 0;
var clockOffset = 0;
var setClockOffsetTimer = null;
var checkOffsetTimer = null;
var checkOffsetCounter = 0;
var dateOffset = 0;
var setDateOffsetTimer = null;
var isTopRowSelected = true;
var columnCounter = 0;
var itemCounter = 0;
var myLocation = "index.html";
var myRefreshLocation = null;
var myHistory = [];
var myPos = null;
var loadingTimer = 0;
var detailsOnTop = false;

getDeviceYear = function() {
    var pluginNNavi = document.getElementById("pluginObjectNNavi");
    var firmwareVersion = pluginNNavi.GetFirmware();

    if (firmwareVersion === "") {
        // emulator
        return 2011;
    }

    // Log("JTDEBUG getDeviceYear: " + Number(firmwareVersion.substr(10, 4)))
    return Number(firmwareVersion.substr(10, 4));
};

getCookie = function (cName) {
    var i,x,y,ARRcookies=document.cookie.split(";");
    for (i=0;i<ARRcookies.length;i++)
    {
        x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
        y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
        x=x.replace(/^\s+|\s+$/g,"");
        if (x==cName)
        {
            return unescape(y);
        }
    }
    return null;
};

setCookie = function(cName,value,exdays)
{
    var exdate=getCurrentDate();
    exdate.setDate(exdate.getCurrentDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=cName + "=" + c_value;
};

String.prototype.trim = function () {
    return this.replace(/^\s*/, "").replace(/\s*$/, "");
};

loadingStart = function() {
    try {
        if (loadingTimer == 0) {
            loadingTimer = window.setTimeout(function () {
                $('#loading').sfLoading('show');
            }, 500);
        }
    } catch(err) {
        return;
    }
};

loadingStop = function() {
    try {
        clearTimeout(loadingTimer);
        loadingTimer = 0;
        $('#loading').sfLoading('hide');  
    } catch(err) {
        return;
    }
};

refreshLocation = function(entry)
{
    myRefreshLocation = entry.loc;
    Language.fixAButton();
    dispatch(myRefreshLocation, true);
};

// Methods for "restoring" item position during "history.back"
setLocation = function(location, oldPos)
{
    if (location == myLocation)
        return;
    if (oldPos == undefined) {
        myPos = null;
        myHistory.push(
            {
                loc: myLocation,
                pos: 
                {
                    col: columnCounter,
                    top: isTopRowSelected
                }
            }
        );
        detailsOnTop = false;
    } else {
        myPos = oldPos;
    }

    var isDetails = location.match(/details.html/);
    myLocation = location;
    myRefreshLocation = null;
    Buttons.setKeyHandleID(0); // default

    if (isDetails) {
        if (oldPos == undefined) {
            detailsOnTop = true;
        } else {
            detailsOnTop = false;
        }
    } else {
        Language.fixAButton();
    }
    if ((isDetails && !detailsOnTop) || !detailsOnTop)
    {
        itemSelected = null;
        itemCounter = 0;
        columnCounter = 0;
        isTopRowSelected = true;
    }
    resetHtml(oldPos, isDetails);
    loadingStart();
    dispatch(myLocation);

    if (detailsOnTop && oldPos) {
        restorePosition();
        detailsOnTop = false;
    }
    // window.location = location;
};

dispatch = function(NewLocation, Refresh) {
    switch (NewLocation.match(/([a-zA-Z]+)\.html/)[1])
    {
    case "details":
        Details.onLoad(Refresh);
        break;

    case "index":
        Main.onLoad(Refresh);
        break;

    case "live":
        live.onLoad(Refresh);
        break;

    case "categories":
        Categories.onLoad(Refresh);
        break;

    case "categoryDetail":
        categoryDetail.onLoad(Refresh);
        break;

    case "showList":
        showList.onLoad(Refresh);
        break;

    case "SearchList":
        SearchList.onLoad(Refresh);
        break;

    case "LastChance":
    case "Latest":
    case "LatestNews":
        Section.onLoad(NewLocation, Refresh);
        break;

    default:
        Log("Unknown loaction!!!!" + NewLocation);
    }
};

resetHtml = function(oldPos, isDetails)
{
    // Delete and hide details
    $(".content").hide();
    $('#projdetails').html("");
    // Delete and show list
    if ((isDetails && !detailsOnTop) || !detailsOnTop) {
        $('#topRow').html("");
        $('#bottomRow').html("");
        $('.content-holder').css("marginLeft", "0");
    }
    $(".slider-body").show();
    if (oldPos)
        $("#content-scroll").hide();
    else
        $("#content-scroll").show();
};

goBack = function(location)
{
    if (myHistory.length > 0) {
        oldLocation = myHistory.pop(),
        setLocation(oldLocation.loc, oldLocation.pos);
    }
    // history.go(-1);
};

restorePosition = function() 
{
    if (myPos) {
        setPosition(myPos);
    }
    if (myRefreshLocation) {
        detailsOnTop = true;
    } else {
        loadingStop();
    }
    return myPos;
};

fetchPriorLocation = function() 
{
    refreshLocation(myHistory[myHistory.length-1]);
};

setPosition = function(pos)
{
    if (itemSelected) {
        itemSelected.removeClass('selected');
    } else {
        $('.topitem').eq(0).removeClass('selected');
    }
    if (pos.top) itemSelected = $('.topitem').eq(pos.col).addClass('selected');
    else         itemSelected = $('.bottomitem').eq(pos.col).addClass('selected');
    columnCounter    = pos.col;
    isTopRowSelected = pos.top;
    // Log("Position set to "  + columnCounter + " " + isTopRowSelected);
    Buttons.sscroll();
};

getCurrentDate = function() {
    try {
        var pluginTime = document.getElementById("pluginTime").GetEpochTime();
        if (pluginTime && pluginTime > 0)
            return new Date(pluginTime*1000 + clockOffset);
    } catch(err) {
        // Log("pluginTime failed:" + err);
    }
    return new Date();
}

setOffsets = function() {
    // Retry once a minute in case of failure
    window.clearTimeout(setClockOffsetTimer);
    setClockOffsetTimer = window.setTimeout(setOffsets, 60*1000);
    var timeXhr = new XMLHttpRequest();
    timeXhr.onreadystatechange = function () {
        if (timeXhr.readyState == 4) {
            var timeMatch = timeXhr.responseText.match(/class=h1>([0-9]+):([0-9]+):([0-9]+)</)
            var actualSeconds = timeMatch[1]*3600 + timeMatch[2]*60 + timeMatch[3]*1;
            var actualDay = +timeXhr.responseText.match(/id=ctdat>[^0-9]+([0-9]+)/)[1];
            var oldClockOffset = clockOffset;
            clockOffset = 0;
            var now = getCurrentDate();
            var nowSeconds = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
            var nowDay = now.getDate();
            if (actualDay != nowDay) {
                if (actualDay > nowDay || actualDay == 1) {
                    // Add 24 hours to actual
                    actualSeconds = actualSeconds + 24*3600;
                } else {
                    // Add 24 hours to now
                    nowSeconds = nowSeconds + 24*3600
                }
            }
            var newClockOffset = Math.round((actualSeconds-nowSeconds)/3600)*3600*1000;
            Log("Clock Offset hours:" + newClockOffset/3600/1000 + " actualDay:" + actualDay + " nowDay:" + nowDay + " timeMatch:" + timeMatch[0] + " now:" + now);
            if (checkOffsetTimer == null || checkOffsetCounter > 0) {
                if (checkOffsetTimer == null) {
                    checkOffsetCounter = 10;
                } else {
                    checkOffsetCounter = checkOffsetCounter - 1;
                }
                if (newClockOffset != oldClockOffset && checkOffsetTimer != null) {
                    Log("Clock Offset was changed!!!");
                } else {
                    checkOffsetTimer = window.setTimeout(setOffsets, 10*1000);
                }
            }
            clockOffset = newClockOffset;
            timeXhr.destroy();
            timeXhr = null;
	    window.clearTimeout(setClockOffsetTimer);
        }
    };
    timeXhr.open("GET", "http://www.timeanddate.com/worldclock/sweden/stockholm");
    timeXhr.send();
    setDateOffset();
};

setDateOffset = function () {
    // Retry once a minute in case of failure
    window.clearTimeout(setDateOffsetTimer);
    setDateOffsetTimer = window.setTimeout(setDateOffset, 60*1000);
    var timeXhr = new XMLHttpRequest();
    timeXhr.onreadystatechange = function () {
        if (timeXhr.readyState == 4) {
            var data = timeXhr.responseText.split("<div class=\"play_js-schedule__entry")[1];
            var actualData = $(data).find('time').attr('datetime').match(/([0-9\-]+)T([0-9]+).([0-9]+)/);
            var actualSeconds = actualData[2]*3600 + actualData[3]*60;
            var actualDateString = actualData[1].replace(/-/g, "")
            var tsDate = new Date(+data.match(/data-starttime=\"([0-9]+)/)[1]);           
            var tsSeconds = tsDate.getHours()*3600 + tsDate.getMinutes()*60 + tsDate.getSeconds();
            var tsDateString = dateToString(tsDate);
            if (actualDateString > tsDateString) {
                // Add 24 hours to actual
                actualSeconds = actualSeconds + 24*3600;
            } else if (tsDateString > actualDateString) {
                // Add 24 hours to ts
                tsSeconds = tsSeconds + 24*3600
            }
            var newDateOffset = Math.round((actualSeconds-tsSeconds)/3600)*3600*1000;
            Log("dateOffset (hours):" + newDateOffset/3600/1000 + " actualDate:" + actualDateString + " tsDate:" + tsDateString + " tsDate:" + tsDate + " ts:" + data.match(/data-starttime=\"([0-9]+)/)[1] + " starttime:" + actualData[0]);
            dateOffset = newDateOffset;
            timeXhr.destroy();
            timeXhr = null;
	    window.clearTimeout(setDateOffsetTimer);
        }
    };
    timeXhr.open("GET", "http://www.svtplay.se/kanaler");
    timeXhr.send();
};

dateToString = function (Date) {
    var Day = Date.getDate()
    Day = Day < 10 ?  "0" + Day : "" + Day;
    var Month = Date.getMonth()+1;
    Month = Month < 10 ?  "0" + Month : "" + Month;
    return Date.getFullYear() + Month + Day;
}

tsToClock = function (ts)
{
    var time = new Date(+ts + dateOffset);
    var hour = time.getHours();
    var minutes = time.getMinutes();
    if (hour < 10) hour = "0" + hour;
    if (minutes < 10) minutes = "0" + minutes;
    return hour + ":" + minutes;
};

fixLink = function (ImgLink) 
{
    if (ImgLink.match(/^\/\//)) {
        return "http:" + ImgLink;
    } else if (!ImgLink.match("https*:")) {
        if (!ImgLink.match(/^\//))
            ImgLink = "/" + ImgLink;
        return "http://www.svtplay.se" + ImgLink
    } else {
        return ImgLink
    }
};

requestUrl = function(url, cbSucces, cbError, cbComplete) {

    var requestedLocation = {loc:myLocation, refLoc:myRefreshLocation};
    $.support.cors = true;
    $.ajax(
        {
            type: 'GET',
            url: url,
            tryCount : 0,
            retryLimit : 3,
	    timeout: 15000,
            success: function(data, status, xhr)
            {
                Log('Success:' + this.url);
                data = null;
                callUrlCallBack(requestedLocation, cbSucces, status, xhr)
                xhr.destroy();
                xhr = null;
            },
            error: function(XMLHttpRequest, textStatus, errorThrown)
            {
                if (isRequestStillValid(requestedLocation)) {

                    this.tryCount++;
          	    if (textStatus == 'timeout' && this.tryCount <= this.retryLimit) {
                        //try again
                        return $.ajax(this);
                    } else {
        	        Log('Failure:' + this.url + " status:" + textStatus + " error:" + errorThrown);
        	        ConnectionError.show();
                        callUrlCallBack(requestedLocation, cbError, status, errorThrown);
        	    }
                }
            },
            complete: function(xhr, status)
            {
                callUrlCallBack(requestedLocation, cbComplete, status, xhr);
            }
        }
    );
};

callUrlCallBack = function(requestedLocation,cb,status,xhr) {
    if (cb && isRequestStillValid(requestedLocation))
        cb(status, xhr);
    else if (cb)
        Log("url skipped:" + requestedLocation.loc + " " + requestedLocation.refLoc + " Now:" + myLocation + " " +  myRefreshLocation);
};

isRequestStillValid = function (request) {
    return (request.loc == myLocation && request.refLoc == myRefreshLocation);x
}

Log = function (msg) 
{
    // var logXhr = new XMLHttpRequest();
    // logXhr.onreadystatechange = function () {
    //     if (logXhr.readyState == 4) {
    //         logXhr.destroy();
    //         logXhr = null;
    //     }
    // };
    // logXhr.open("GET", "http://<LOGSERVER>/log?msg='[PlaySE] " + seqNo++ % 10 + " : " + msg + "'");
    // logXhr.send();
    alert(msg);
};