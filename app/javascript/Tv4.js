var Tv4 =
{
    result:[],
    unavailableShows:[],
    updatingUnavailableShows:false
};

Tv4.fetchUnavailableShows = function() {
    if (Config.read("tv4DrmShows"))
        Config.remove("tv4DrmShows");
    var savedShows = Config.read("tv4UnavailableShows");
    var days = 24*3600*1000;
    var tsDiff = (savedShows) ? (getCurrentDate().getTime()-savedShows.ts)/days : null;
    if (savedShows && tsDiff < 7 && tsDiff >= 0) {
        Tv4.unavailableShows = savedShows.shows.split(";");
        Log("Found saved unavailable shows, Days:" + Math.floor(tsDiff) + " length:" + Tv4.unavailableShows.length);
    } else {
        Tv4.refreshdUnavailableShows();
    }
}

Tv4.refreshdUnavailableShows = function() {
    if (Tv4.updatingUnavailableShows)
        // Already updating
        return;
    Tv4.updatingUnavailableShows = true;
    httpRequest(Tv4.getUrl("allShows"),
                {cb:function(status,data) {
                    Tv4.unavailableShows = [];
                    data = JSON.parse(data);
                    var i = 0;
                    return Tv4.checkShows(i, data.results);
                },
                 no_log:true
                });
};

Tv4.checkShows = function(i, data) {
    if (i < data.length)
    {
        httpRequest(Tv4.getUrl("episodes") + data[i].nid,
                    {cb:function(status, episode) {
                        episode = JSON.parse(episode).results;
                        var anyViewable = false;
                        for (var k=0; k < episode.length; k++) {
                            if (Tv4.isViewable(episode[k])) {
                                anyViewable = true
                                break;
                            }
                        }
                        if (!anyViewable) {
                            Tv4.unavailableShows.push(data[i].nid)
                        }
                        return Tv4.checkShows(i+1, data);
                    },
                     no_log:true
                    });
    }
    else {
        Log("Saving unavailable shows, length:" + Tv4.unavailableShows.length);
        Config.save("tv4UnavailableShows", {ts:getCurrentDate().getTime(), shows:Tv4.unavailableShows.join(";")});
        Tv4.updatingUnavailableShows = false;
        data = null;
    }
}

Tv4.reCheckUnavailableShows = function(data) {
    if (!Tv4.updatingUnavailableShows && !data.is_clip && data.program)
    {
        var showIndex = Tv4.unavailableShows.indexOf(data.program.nid);
        if (showIndex != -1) {
            Tv4.unavailableShows.splice(showIndex,1);
            var savedShows = Config.read("tv4UnavailableShows");
            savedShows.shows = Tv4.unavailableShows.join(";");
            Config.save("tv4UnavailableShows", savedShows);
            alert(data.program.name + " is now available");
        }
    }
}

Tv4.getMainTitle = function () {
    return "Rekommenderat"
}

Tv4.getSectionTitle = function(location) {
    if (location.match(/Latest.html/))
        return 'Senaste';
    else if (location.match(/LatestClips.html/))
        return 'Senaste Klipp';
    else if (location.match(/PopularClips.html/))
        return 'Populära Klipp';
}

Tv4.getUrl = function(tag, extra) {
    var type = "episode"
    var drm = (deviceYear > 2011) ? "" : "&is_drm_protected=false"
    switch (tag)
    {
    case "main":
        Tv4.fetchUnavailableShows();
        return "http://api.tv4play.se/play/programs?per_page=50&page=1&recommended=true";

    case "section":
        switch(extra.location) {
        case "LatestClips.html":
            type = "clip";
        case "Latest.html":
            var endDate = getCurrentDate();
            endDate.setDate(endDate.getDate() + 1)
            var startDate = getCurrentDate();
            startDate.setDate(startDate.getDate() - 7);
            return 'http://api.tv4play.se/play/video_assets?is_live=false&platform=web&premium=false&sort=broadcast_date_time&sort_order=desc&per_page=100&broadcast_from=' + dateToString(startDate) + '&broadcast_to=' + dateToString(endDate) + '&type=' + type + drm;

        case "PopularClips.html":
            type = "clip"
            break;
        default:
            break;
        }
        return 'http://api.tv4play.se/play/video_assets/most_viewed?page=1&is_live=false&platform=web&per_page=100&sort_order=desc&type=' + type + drm;

    case "live":
        var startDate = getCurrentDate();
        var endDate   = getCurrentDate();
        endDate.setDate(startDate.getDate() + 4);
        return 'http://api.tv4play.se/play/video_assets?broadcast_from' + dateToString(startDate) + '&broadcast_to=' + dateToString(endDate) + '&is_live=true&platform=web&sort=broadcast_date_time&sort_order=asc&per_page=100'
        break;

    case "categories":
        switch (Tv4.getCategoryIndex().current) {
            case 0:
            return 'http://api.tv4play.se/play/categories';

            case 1:
            case 2:
            return "http://api.tv4play.se/play/programs?per_page=1000&page=1&fl=name,nid,program_image,description,tags"
        };
        break;

    case "categoryDetail":
        return extra.location
        break;

    case "categoryUrl":
        return 'http://api.tv4play.se/play/programs?per_page=1000&page=1&category='
        break;

    case "allShows":
        return 'http://api.tv4play.se/play/programs?per_page=1000&page=1&fl=name,nid,program_image'
        break;

    case "clips":
        type = "clip"
    case "episodes":
        return 'http://api.tv4play.se/play/video_assets?is_live=false&page=1&per_page=250&platform=web&type=' + type + drm + '&node_nids='
        break;

    case "searchList":
        if (extra.query.length == 1)
            return Tv4.getUrl("allShows", extra)
        else
            return 'http://api.tv4play.se/play/programs?per_page=100&platform=web&q=' + extra.query

    case "searchVideos":
        return 'http://api.tv4play.se/play/video_assets?is_live=false&per_page=200&platform=web' + drm + '&q=' + extra.query

    case "popular":
        return 'http://api.tv4play.se/play/video_assets/most_viewed?page=1&is_live=false&platform=web&per_page=100&sort_order=desc&type=' + type + drm;

    default:
        return tag;
        break;
    }
};

Tv4.getCategoryTitle = function() {
    switch (Tv4.getCategoryIndex().current) {
    case 0:
        return "Kategorier";
    case 1:
        return "Alla Kategorier";
    case 2:
        return "Alla Program";
    }
};

Tv4.upgradeUrl = function(url) {
    return url.replace("webapi.tv4play","api.tv4play")
}

Tv4.decodeMain = function(data, extra) {
    var cbComplete = extra.cbComplete;
    extra.cbComplete = null;
    extra.recommended_nids = Tv4.decodeShows(data, extra);
    requestUrl(Tv4.getUrl("popular", extra),
                   function(status, data)
                   {
                       Tv4.decodeShows(data, extra);
                       data = null;
                   },
                   {cbComplete:cbComplete}
                  );
};

Tv4.decodeSection = function(data, extra) {
    Tv4.decode(data, extra);
};

Tv4.decodeCategories = function(data, extra) {

    var Name;
    var Link;

    try {
        switch (Tv4.getCategoryIndex().current) {
            case 0:
            data = JSON.parse(data.responseText);
            for (var k=0; k < data.length; k++) {
                Name = data[k].name;
	        Link = Tv4.getUrl("categoryUrl") + data[k].nid;
                categoryToHtml(Name, null, null, Link);
	    }
            break;

            case 1:
            var Categories = [];
            data = JSON.parse(data.responseText).results;
            for (var k=0; k < data.length; k++) {
                if (!data[k].tags) {
                    continue;
                }
                data[k] = data[k].tags;
                for (var i=0; i < data[k].length; i++) {
                    if (Categories.indexOf(data[k][i]) != -1)
                        continue;
                    Categories.push(data[k][i])
                }
            }
            Categories.sort(function(a, b) {
                if (a.toLowerCase() > b.toLowerCase())
                    return 1
                else
                    return -1
            });
            for (var k=0; k < Categories.length; k++) {
                Name = Tv4.tagToName(Categories[k]);
	        Link = Tv4.getUrl("categoryUrl") + encodeURIComponent(Categories[k]);
                categoryToHtml(Name, null, null, Link);
	    }
            break;

            case 2:
            Tv4.decodeShows(data, extra);
            extra.cbComplete = null;
            break;
        }
        data = null;
    } catch(err) {
        Log("Tv4.decodeCategories Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Tv4.decodeCategoryDetail = function(data, extra) {
    Tv4.decodeShows(data, extra);
};

Tv4.decodeLive = function(data, extra) {
    Tv4.decode(data, extra);
};

Tv4.decodeShowList = function(data, extra) {

    if (!extra.is_clips && !extra.season) {
        data = JSON.parse(data.responseText).results;
        var showThumb = (data.length > 0) ? Tv4.fixThumb(data[0].program.program_image) : null;
        var seasons = [];
        var non_seasons = [];
        var cbComplete = extra.cbComplete;

        // 0 Means the only season
        if (extra.season != 0) {
            // Find seasons and non-seasons
            for (var k=0; k < data.length; k++) {
                if (data[k].season && seasons.indexOf(data[k].season) == -1)
                    seasons.push(data[k].season);
                else if (!data[k].season)
                    non_seasons.push(data[k])
            }
            if (seasons.length > 1 || non_seasons.length >= 1) {
                seasons.sort(function(a, b){return b-a})
                for (var i=0; i < seasons.length; i++) {
                    seasonToHtml("Säsong " + seasons[i],
                                 showThumb,
                                 extra.url + "&season=" + seasons[i],
                                 seasons[i]
                                )
                };
            } else if (seasons.length == 1) {
                return callTheOnlySeason("Säsong " + seasons[0], extra.url, extra.loc);
            }
        }

        extra.cbComplete      = false;
        extra.already_decoded = true;

        if (extra.season == 0) {
            Tv4.decode(data, extra);
        } else if (non_seasons.length) {
            Tv4.decode(non_seasons, extra);
        }

        // Check if clips exists
        var clips_url;
        if (data.length > 0) {
            clips_url = Tv4.getUrl("clips") + data[0].program.nid;
        } else {
            clips_url = getLocation().replace(/.+(http.+)&history.+/, "$1")
            clips_url = clips_url.replace("episode", "clips")
        }
        var data = JSON.parse(httpRequest(clips_url+"&per_page=1", {sync:true}).data);
        if (data.total_hits > 0) {
            clipToHtml(showThumb,
                       clips_url
                      )
        }
        if (cbComplete) cbComplete();
    } else {
        Tv4.decode(data, extra)
    }
};

Tv4.decodeSearchList = function(data, extra) {

    var cbComplete = extra.cbComplete;
    extra.cbComplete = null;
    Tv4.decodeShows(data, extra);
    data = null;
    if (extra.query.length > 1) {
        requestUrl(Tv4.getUrl("searchVideos", extra),
                   function(status, data)
                   {
                       Tv4.decode(data);
                       data = null;
                   },
                   {cbComplete:cbComplete}
                  );
    } else if (cbComplete)
        cbComplete();
};

Tv4.getHeaderPrefix = function() {
    return "Tv4";
}

Tv4.keyRed = function() {
    if ($("#a-button").text().match(/Pop.*lip/)) {
	setLocation('PopularClips.html');
    } else if ($("#a-button").text().match(/lip/)) {
	setLocation('LatestClips.html');
    } else if ($("#a-button").text().match(/^Re/)) {
	setLocation('index.html');
    } else {
	setLocation('Latest.html');
    }
}

Tv4.keyGreen = function() {
    if ($("#b-button").text().match(/^[CK]ateg/))
	setLocation('categories.html');
    else
        setLocation(Tv4.getNextCategory())
}

Tv4.getNextCategory = function() {
    return getNextIndexLocation(2);
}

Tv4.getCategoryIndex = function () {
    return getIndex(2)
};

Tv4.getLiveTitle = function() {
    return 'Livesändningar';
}

Tv4.getAButtonText = function(language) {

    var loc = getIndexLocation();

    if (loc.match(/index\.html/)) {
        if(language == 'English'){
	    return 'Latest';
        } else {
	    return 'Senaste';
        }
    } else if (loc.match(/Latest\.html/)) {
        if(language == 'English'){
	    return 'Popular Clips';
        } else {
	    return 'Populära Klipp';
        }
    } else if (loc.match(/PopularClips\.html/)) {
        if(language == 'English'){
	    return 'Latest Clips';
        } else {
	    return 'Senaste Klipp';
        }
    } else {
        if(language == 'English'){
	    return 'Recommended';
        } else {
	    return 'Rekommenderat';
        }
    }
};

Tv4.getBButtonText = function(language) {
    if (getIndexLocation().match(/categories\.html/)) {
        switch (Tv4.getCategoryIndex().next) {
        case 0:
            // Use Default
            return null;
        case 1:
            if (language == "Swedish")
                return "Alla Kategorier";
            else
                return "All Categories";
            break
        case 2:
            if (language == "Swedish")
                return "Alla Program";
            else
                return "All Shows";
            break;
        }
    } else
        return null
};

Tv4.getCButtonText = function (language) {
    if(language == 'English')
	return 'Live broadcasts';
    else
        return 'Livesändningar';
};

Tv4.determineEpisodeName = function(data) {
    var Name = data.title.trim();
    var Show = (data.program) ? data.program.name : null;
    if (Show && Name != Show) {
        Name = Name.replace(Show,"").replace(/^[,. :\-]*/,"").trim();
        Name = Name.capitalize();
    }
    return Name
}
Tv4.decode = function(data, extra) {
    try {
        var Name;
        var Duration;
        var IsLive;
        var IsLiveText;
        var IsRunning;
        var starttime;
        var Link;
        var Description;
        var ImgLink;
        var Background;
        var next = null;
        var AirDate;
        var Show=null;
        var Season=null;
        var Episode=null;
        var CurrentDate = getCurrentDate();

        if (!extra)
            extra = {};

        Tv4.result = [];
        if (!extra.already_decoded)
            data = JSON.parse(data.responseText).results;

        for (var k=0; k < data.length; k++) {
            Name = data[k].title.trim();
            Show = (data[k].program) ? data[k].program.name : null;
            IsLive = data[k].is_live;
            if (!Tv4.isViewable(data[k], IsLive, CurrentDate))
                // Premium/DRM
                continue;
            Tv4.reCheckUnavailableShows(data[k]);

            starttime = (IsLive) ? timeToDate(data[k].broadcast_date_time) : null;
            IsRunning = IsLive && starttime && (getCurrentDate() > starttime);

            if (extra.strip_show) {
                Name = Tv4.determineEpisodeName(data[k])
            }
            ImgLink = Tv4.fixThumb(data[k].image);
            Background = Tv4.fixThumb(data[k].image, BACKGROUND_THUMB_FACTOR);
            Duration = data[k].duration;
            Description = (data[k].description) ? data[k].description.trim() : "";
            Link = "http://api.tv4play.se/play/video_assets?id=" +  data[k].id;
            AirDate = data[k].broadcast_date_time;
            Season = (data[k].season) ? data[k].season : null;
            Episode = (data[k].episode) ? data[k].episode : null;
            Tv4.result.push({name:Name, 
                             show:Show,
                             season:Season,
                             episode:Episode,
                             link:Link, 
                             thumb:ImgLink,
                             background:Background,
                             duration:Duration, 
                             description:Description,
                             airDate:AirDate,
                             link_prefix:'<a href="details.html?ilink=',
                             is_live:IsLive,
                             starttime:starttime,
                             is_running:IsRunning
                            }
                           );
        }
       
        if (extra.strip_show) {
            if (Tv4.result.length == 0) {
                // Has become unavailable...
                Tv4.unavailableShows.push(data[0].program.nid)
            }
            Tv4.result.sort(function(a, b){
                if (!a.episode || !b.episode)
                    return Tv4.sortOnAirDate(a, b)

                if (a.season == b.season) {
                    if (a.episode == b.episode) {
                        return Tv4.sortOnAirDate(a, b)
                    } else if (!b.episode || +a.episode > +b.episode) {
                        return -1
                    } else {
                        return 1
                    }
                } else if (!b.season || +a.season > +b.season) {
                    return -1
                } else
                    return 1
            })
        };

        for (var k=0; k < Tv4.result.length; k++) {
            if (!Tv4.result[k].link_prefix) {
                showToHtml(Tv4.result[k].name,
                           Tv4.result[k].thumb,
                           Tv4.result[k].link
                          );
            } else {
                
                toHtml({name:Tv4.result[k].name,
                        duration:Tv4.result[k].duration,
                        is_live:Tv4.result[k].is_live,
                        is_channel:false,
                        is_running:Tv4.result[k].is_running,
                        starttime:Tv4.result[k].starttime,
                        link:Tv4.result[k].link,
                        link_prefix:Tv4.result[k].link_prefix,
                        description:Tv4.result[k].description,
                        thumb:Tv4.result[k].thumb,
                        background:Tv4.result[k].background,
                        show:Tv4.result[k].show,
                        season:Tv4.result[k].season,
                        episode:Tv4.result[k].episode
                       });
            }
	}
        data = null;
        Tv4.result = [];
    } catch(err) {
        Log("Tv4.decode Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();
};

Tv4.sortOnAirDate = function(a,b) {
    if (a.airDate > b.airDate)
        return -1
    else
        return 1
}

Tv4.decodeShows = function(data, extra) {
    try {
        var Name;
        var Link;
        var ImgLink;
        var next = null;
        var checkSeasons=false;
        var json = null;
        var queryTest = (extra.query && extra.query.length == 1) ? new RegExp("^" + extra.query, 'i') : null;
        var nids = [];
        var CurrentDate = getCurrentDate();

        Tv4.result = [];
        data = JSON.parse(data.responseText).results;
        for (var k=0; k < data.length; k++) {
            if (extra.recommended_nids) {
                if (!Tv4.isViewable(data[k], false, CurrentDate))
                    // Premium/DRM
                    continue;
                if (!data[k].program)
                    continue
                Tv4.reCheckUnavailableShows(data[k]);
                data[k] = data[k].program
                if (extra.recommended_nids.indexOf(data[k].nid) != -1)
                    continue;
                else
                    extra.recommended_nids.push(data[k].nid);
            }
            Name = data[k].name;
            if (queryTest && !queryTest.test(Name))
                continue;
            if (Tv4.unavailableShows.indexOf(data[k].nid) != -1)
                // Only drm/premium episodes
                continue;
            ImgLink = Tv4.fixThumb(data[k].program_image);
            Link = Tv4.getUrl("episodes") + data[k].nid
            Tv4.result.push({name:Name, link:Link, thumb:ImgLink});
            nids.push(data[k].nid);
        }
        data = null;

        if (!extra.query || queryTest) {
            Tv4.result.sort(function(a, b) {
                if (a.name.toLowerCase() > b.name.toLowerCase())
                    return 1
                else
                    return -1
            });
        }

        for (var k=0; k < Tv4.result.length; k++) {
            showToHtml(Tv4.result[k].name,
                       Tv4.result[k].thumb,
                       Tv4.result[k].link
                      );
        }
        Tv4.result = [];
    } catch(err) {
        Log("Tv4.decodeShows Exception:" + err.message + " data[" + k + "]:" + JSON.stringify(data[k]));
    }
    if (extra.cbComplete)
        extra.cbComplete();

    return nids;
};

Tv4.getDetailsData = function(url, data) {

    if (url.match(/\?nids=/))
        return Tv4.getShowData(url,data);

    var Name="";
    var Title = Name;
    var DetailsImgLink="";
    var AirDate="";
    var VideoLength = "";
    var AvailDate=null;
    var Description="";
    var NotAvailable=false;
    var isLive=false;
    var Show=null;
    var Season=null;
    var Episode=null;
    var EpisodeName = null;
    try {

        data = JSON.parse(data.responseText).results[0];

        Name = data.title;
        Title = Name;
	DetailsImgLink = Tv4.fixThumb(data.image, DETAILS_THUMB_FACTOR);
        Description  = (data.description) ? data.description.trim() : "";
        AirDate = timeToDate(data.broadcast_date_time);
        VideoLength = dataLengthToVideoLength(null, data.duration);
        isLive = data.is_live;
        AvailDate = data.availability.human.match(/\(([^)]+ dag[^) ]*)/);
        AvailDate = (AvailDate) ? AvailDate[1] : data.availability.availability_group_free + ' dagar'
        AvailDate = (AvailDate.match(/dag(ar)?$/)) ? AvailDate + " kvar" : AvailDate;
        if (data.expire_date_time)
            AvailDate = dateToString(timeToDate(data.expire_date_time),"-") + ' (' + AvailDate + ')';
        
        if (isLive) {
            NotAvailable = ((AirDate - getCurrentDate()) > 60*1000);
        } else {
            NotAvailable = false;
        }
        if (data.program && Tv4.unavailableShows.indexOf(data.program.nid) == -1) {
            Show = {name : data.program.name,
                    // Will fail if there's only clips...
                    url   : Tv4.getUrl("episodes") + data.program.nid,
                    thumb : Tv4.fixThumb(data.program.program_image)
                   }
        }
        Season = (data.season) ? data.season : null;
        Episode = (data.episode) ? data.episode : null;
        EpisodeName = Tv4.determineEpisodeName(data);
    } catch(err) {
        Log("Tv4.getDetailsData Exception:" + err.message);
        Log("Name:" + Name);
        Log("AirDate:" + AirDate);
        Log("AvailDate:" + AvailDate);
        Log("VideoLength:" + VideoLength);
        Log("Description:" + Description);
        Log("NotAvailable:" + NotAvailable);
        Log("DetailsImgLink:" + DetailsImgLink);
    }
    data = null;
    return {name          : Name,
            title         : Title,
            is_live       : isLive,
            air_date      : AirDate,
            avail_date    : AvailDate,
            start_time    : AirDate,
            duration      : VideoLength,
            description   : Description,
            not_available : NotAvailable,
            thumb         : DetailsImgLink,
            season        : Season,
            episode       : Episode,
            episode_name  : EpisodeName,
            parent_show   : Show
    }
};

Tv4.getShowData = function(url, data) {
    var Name="";
    var Genre = [];
    var DetailsImgLink="";
    var Description="";

    try {

        data = JSON.parse(data.responseText).results[0];
        Name = data.name;
        Description = data.description.trim();
	DetailsImgLink = Tv4.fixThumb(data.program_image, DETAILS_THUMB_FACTOR);
        for (var i=0; i < data.tags.length; i++) {
            Genre.push(Tv4.tagToName(data.tags[i]));
        }
        Genre = Genre.join('/');
    } catch(err) {
        Log("Tv4.getShowData exception:" + err.message);
        Log("Name:" + Name);
        Log("Genre:" + Genre);
        Log("Description:" + Description);
        Log("DetailsImgLink:" + DetailsImgLink);
    }
    data = null;
    return {show          : true,
            name          : Name,
            description   : Description,
            genre         : Genre,
            thumb         : DetailsImgLink
           };
};

Tv4.getDetailsUrl = function(streamUrl) {
    if (streamUrl.match(/&node_nids=/))
        return 'http://api.tv4play.se/play/programs?nids=' + streamUrl.replace(/.+&node_nids=([^&]+).*/, "$1");
    else
        return streamUrl;
};

Tv4.getPlayUrl = function(streamUrl, isLive, drm, hlsUrl) {

    var asset = streamUrl.replace(/.*\?id=([^&]+).*/, "$1");
    var protocol = (drm) ? "&device=samsung-orsay&protocol=mss" : "&device=browser&protocol=dash"
    var reqUrl = "https://playback-api.b17g.net/media/" + asset + "?service=tv4&drm=playready" + protocol;
    hlsUrl = hlsUrl || reqUrl.replace(/dash/,"hls")

    if (isLive)
        reqUrl = reqUrl + "&is_live=true"

    var cbComplete = function(stream, srtUrl, license) {
        if (!stream) {
            $('.bottomoverlaybig').html('Not Available!');
        } else {
            Resolution.getCorrectStream(stream,
                                        srtUrl,
                                        {useBitrates:!isLive,
                                         license:license,
                                         isLive:isLive,
                                         // Seems we get 304 response which ajax doesn't like?
                                         no_cache:true
                                        });
        }}

    requestUrl(RedirectIfEmulator(reqUrl),
               function(status, data)
               {
                   if (Player.checkPlayUrlStillValid(streamUrl)) {
                       var stream=null, srtUrl=null;
                       data = JSON.parse(data.responseText).playbackItem;
                       stream = data.manifestUrl;
                       license = data.license && data.license.url;
                       if (!drm && license && reqUrl != hlsUrl) {
                           hlsUrl = stream.replace(/\.mpd/,".m3u8");
                           return Tv4.getPlayUrl(streamUrl, isLive, true, hlsUrl)
                       } else if (!isLive) {
                           hlsUrl = (drm) ? hlsUrl : stream.replace(/\.mpd/,".m3u8");
                           Tv4.getSrtUrl(hlsUrl,
                                         function(srtUrl){
                                             cbComplete(stream, srtUrl, license)
                                         });
                       } else {
                           cbComplete(stream, null, license);
                       }
                   }
               }
              );
};

Tv4.getSrtUrl = function (hlsUrl, cb) {
    var srtUrl = null;
    requestUrl(RedirectIfEmulator(hlsUrl),
               function(status, data) {
                   try {
                       srtUrl = data.responseText.match(/TYPE=SUBTITLES.+URI="([^"]+)/)[1]
                       if (!srtUrl.match(/https?:\//)) {
                           srtUrl = hlsUrl.replace(/[^\/]+(\?.+)?$/,srtUrl);
                       }
                   } catch (err) {
                       Log("No subtitles: " + err + " hlsUrl:" + hlsUrl);
                   }
               },
               {cbComplete: function() {cb(srtUrl)}}
              );
};

Tv4.fixThumb = function(thumb, factor) {
    if (!factor) factor = 1;
    var size = Math.round(factor*THUMB_WIDTH) + "x" + Math.round(factor*THUMB_HEIGHT);
    return RedirectIfEmulator("https://imageproxy.b17g.services/?format=jpeg&quality=80&resize=" + size + "&retina=false&shape=cut&source=" + thumb);
};

Tv4.tagToName = function(string) {
    var words = string.split('-');
    for (var i=0; i < words.length; i++)
        words[i] = words[i].capitalize()
    return words.join(' ');
}

Tv4.isViewable = function (data, isLive, currentDate) {
    if (data.is_drm_protected && deviceYear < 2012 && !isEmulator)
        return false;
    else {
        if (isLive) {
            // We want to see what's ahead...
            return true;
        } else {
            if (!currentDate)
                currentDate = getCurrentDate();
            return currentDate > timeToDate(data.broadcast_date_time);
        }
    }
}

Tv4.requestNextPage = function(url, callback) {
    requestUrl(url,callback,callback);
}

