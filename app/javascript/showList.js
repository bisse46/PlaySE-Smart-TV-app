var showList =
{
};

showList.onLoad = function(refresh)
{
    if (!refresh)
	PathHistory.GetPath();
    if (!detailsOnTop)
	this.loadXml(refresh);
//	widgetAPI.sendReadyEvent();
};

showList.onUnload = function()
{
	Player.deinit();
};


showList.Geturl=function(refresh){
    var url = myLocation;
    if (refresh)
        url = myRefreshLocation;
    var name="";
    if (url.indexOf("name=")>0)
    {
        name = url.match(/name=(.+)&history=/)[1];
    }
    return name;
};

showList.loadXml = function(refresh, alt)
{
    $("#content-scroll").hide();
    var gurl = (alt) ? alt : this.Geturl(refresh);
    requestUrl(gurl,
               function(status, data)
               {
                   switch (channel) {
                   case "svt":
                       var CLIPS_TAG = "<div id=\"play_js-tabpanel-more-clips"
                       data = data.responseText.split("id=\"videos-in-same-category")[0];
                       if (!alt) {
                           alt = showList.get_pagination_url(data.split(CLIPS_TAG)[0]);
                           if (alt) {
                               return showList.loadXml(refresh, alt)
                           }
                       }

                       if (!data.match("play_js-tabs")) {
                           data = data.split("<article").slice(1).join("<article");
                           Section.decode_data("<article" + data);
                       } else {
                           data = "<section class=\"play_js-tabs\"" + data.split("class=\"play_js-tabs")[1];
                           data = data.split(CLIPS_TAG)
                           var clips_data = (data.length > 1) ? showList.get_pagination_url(data[1]) : null;
                           if (clips_data) {
                               clips_data = syncHttpRequest(fixLink(clips_data)).data.split("id=\"videos-in-same-category")[0];
                               data = data[0] + clips_data.split(CLIPS_TAG)[1];
                           } else {
                               data = data.join(CLIPS_TAG);
                           }
                           showList.decode_data(data);
                       }
                       loadFinished(status, refresh);
                       break;

                   case "viasat":
                       Viasat.decode(data.responseText, gurl, true, function(){loadFinished(status, refresh)});
                       break;

                   case "tv4":
                       Tv4.decode(data.responseText, true, function(){loadFinished(status, refresh)});
                       break;

                   case "kanal5":
                       Kanal5.decode(data.responseText, {name:"showList", url:gurl}, true, function(){loadFinished(status, refresh)});
                       break;
                   }
               },
               function(status, data) {
                   loadFinished(status, refresh);
               }
              );
};

showList.get_pagination_url = function(data) {
    var url = data.match(/class=\"play_title-page__pagination\"[^\/]+<a href=\"([^"]+)/);
    return (url && url.length > 0) ? fixLink(url[1]) : null;
}

showList.decode_data = function(showData) {
    try {
        var Name;
        var Duration;
        var Link;
        var ImgLink;
        var Season;
        var Episode;
        var Variant;
        var Shows = [];
        var Names = [];
        var AnyNonInfoEpisode = false;

        showData = showData.split("</article>");
        showData.pop();

        for (var k=0; k < showData.length; k++) {
            
            // Name = $(showData[k]).find('span').filter(function() {
            //         return $(this).attr('class') == "play_videolist-element__title-text";
            //     }).text();
            showData[k] = showData[k].split("<article")[1];
            if (showData[k].match('countdown play_live-countdown'))
                continue;
            Name = showData[k].match(/play_vertical-list__header-link\">([^<]+)</)[1].trim();

            // Duration = showData[k].match(/data-length="([^"]+)"/)[1];
            Duration = showData[k].match(/time>([^<]+)/)[1];
            Link = fixLink(showData[k].match(/href="([^#][^#"]+)"/)[1]);
            ImgLink = showData[k].match(/data-imagename="([^"]+)"/);
            ImgLink = (!ImgLink) ? showData[k].match(/src="([^"]+)"/)[1] : ImgLink[1];
            ImgLink = fixLink(ImgLink);
            showData[k] = "";
            Season  = Name.match(/s[^s]+song[	 ]*([0-9]+)/i);
            Episode = Name.match(/avsnitt[	 ]*([0-9]+)/i);
            Variant = Name.match(/(textat|syntolkat|teckenspr[^k]+kstolkat|originalspr[^k]+k)/i);
            Season  = (Season) ? +Season[1] : null;
            Episode = (Episode) ? +Episode[1] : null;
            Variant = (Variant) ? Variant[1] : null;
            AnyNonInfoEpisode = (AnyNonInfoEpisode) ? AnyNonInfoEpisode : !IsClip({link:Link}) && !Episode;
            Names.push(Name);
            Shows.push({name:Name,
                        duration:Duration,
                        link:Link,
                        link_prefix:'<a href="details.html?ilink=',
                        description:"",
                        thumb:ImgLink,
                        season:Season,
                        episode:Episode,
                        variant:Variant
                       })
        }

        Shows.sort(function(a, b){
            if (IsClip(a) && IsClip(b)) {
                // Keep SVT sorting amongst clips
                return Names.indexOf(a.name) - Names.indexOf(b.name)
            } else if(IsClip(a)) {
                // Clips has lower prio
                return 1
            } else if(IsClip(b)) {
                // Clips has lower prio
                return -1
            } else if (a.variant == b.variant) {
                if (AnyNonInfoEpisode)
                    // Keep SVT sorting in case not all videos has an episod number.
                    return Names.indexOf(a.name) - Names.indexOf(b.name)
                else if (IsNewer(a,b))
                    return -1
                else
                    return 1
            } else if (!a.variant || (b.variant && b.variant > a.variant)) {
                return -1
            } else {
                return 1
            }
        });
        for (var k=0; k < Shows.length; k++) {
            toHtml(Shows[k])
        };
    } catch(err) {
        Log("decode_data Exception:" + err.message + ". showData[" + k + "]:" + showData[k]);
    }
};

IsNewer = function(a,b) {
    if (a.season == b.season) {
        return a.episode > b.episode
    } else if (b.season && a.season) {
        return a.season > b.season
    } else
        return a.season
}

IsClip = function(a) {
    return a.link.match(/\/klipp\//)
}

//window.location = 'project.html?ilink=' + ilink + '&history=' + historyPath + iname + '/';
