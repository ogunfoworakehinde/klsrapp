import React, { useEffect, useRef, useState } from 'react';
import XMLParser from 'react-xml-parser';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import Amplitude, { Song } from "amplitudejs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowCircleLeft, faArrowCircleRight, faBackwardStep, faClock, faForwardStep, faPauseCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";

import {
  IonPage,
  IonBackButton,
  IonButtons,
  IonButton,
  IonHeader,
  IonContent,
  IonNavLink,
  IonToolbar,
  IonTitle,
  IonRefresher,
  IonRefresherContent,
  IonToast
} from '@ionic/react';

import { RefresherEventDetail } from '@ionic/core';
import Error from '../components/Error';

const Podcast = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [play, setPlay] = useState(false);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<any>(null);
  const [podcastData, setPodcastData] = useState<any>();
  let [currentPodcast, setCurrentPodcast] = useState(0);
  const [songs, setSongs] = useState<any>([]);
  const [status, setStatus] = useState({
    loading: false,
    loaded: false,
    error: null as string | null,
  });

  // Refs
  const targetRef = useRef<any>(null);
  const playlistRef = useRef<any>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Calculate current items
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = songs.slice(indexOfFirst, indexOfLast);

  // Calculate total pages
  const totalPages = Math.ceil(songs.length / itemsPerPage);

  // Multiple CORS proxy options
  const PROXY_OPTIONS = [
    {
      name: 'allorigins',
      url: (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    },
    {
      name: 'cors-anywhere',
      url: (targetUrl: string) => `https://cors-anywhere.herokuapp.com/${targetUrl}`
    },
    {
      name: 'cors-proxy',
      url: (targetUrl: string) => `https://cors.bridged.cc/${targetUrl}`
    }
  ];

  const fetchWithProxy = async (url: string, proxyIndex = 0): Promise<Response> => {
    if (proxyIndex >= PROXY_OPTIONS.length) {
      throw new Error('All proxy attempts failed');
    }

    try {
      const proxy = PROXY_OPTIONS[proxyIndex];
      console.log(`🔄 Trying proxy: ${proxy.name}`);
      
      const proxyUrl = proxy.url(url);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/rss+xml, text/xml, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; MyApp/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`Proxy ${proxy.name} failed with status: ${response.status}`);
      }

      console.log(`✅ Proxy ${proxy.name} succeeded`);
      return response;
    } catch (error) {
      console.warn(`❌ Proxy ${PROXY_OPTIONS[proxyIndex].name} failed:`, error);
      
      // Try next proxy
      return fetchWithProxy(url, proxyIndex + 1);
    }
  };

  const doRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    try {
      await fetchPodcastData();
      event.detail.complete();
    } catch (error) {
      setToastMessage('Network error. Please try again.');
      setShowToast(true);
      event.detail.complete();
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const pad = (n: number) => n.toString().padStart(2, '0');
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${pad(date.getFullYear() % 100)} ${pad(hours)}:${pad(date.getMinutes())}${ampm}`;
  };

  const fetchPodcastData = async () => {
    setStatus({ loading: true, loaded: false, error: null });

    try {
      console.log('Starting podcast fetch...');
      
      const rssUrl = 'https://anchor.fm/s/1d6ad87c/podcast/rss';
      
      // Use proxy instead of direct fetch
      const response = await fetchWithProxy(rssUrl);
      
      const str = await response.text();
      console.log('RSS feed fetched successfully');

      const xml = new XMLParser().parseFromString(str);
      const items = xml.getElementsByTagName("item");
      
      if (!items || items.length === 0) {
        throw new Error('No podcast items found in RSS feed');
      }
      
      setPodcastData(items);

      // Parse items based on the actual XML structure
      const newSongs = items.map((ele: any) => {
        const children = ele.children || [];
        
        // Find elements by name since indices might vary
        const findElement = (name: string) => {
          return children.find((child: any) => child.name === name);
        };

        const titleElem = findElement('title');
        const enclosureElem = findElement('enclosure');
        const pubDateElem = findElement('pubDate');
        const descriptionElem = findElement('description');
        const itunesImageElem = findElement('itunes:image');
        
        // Get the cover art URL - this is the correct way based on the XML
        const cover_art_url = itunesImageElem?.attributes?.href;

        console.log('Cover art element:', itunesImageElem);
        console.log('Cover art URL:', cover_art_url);

        return {
          title: titleElem?.value?.replace(/[<>]/g, "") || 'Unknown Title',
          url: enclosureElem?.attributes?.url || '',
          date: formatDate(pubDateElem?.value || ''),
          cover_art_url: cover_art_url || './images/podcast.jpg', // Use actual URL or fallback
          description: descriptionElem?.value?.replace(
            /(<\/?[^>]+(>|$))|(&quot;)|(>)/g,
            " "
          ) || 'No description available',
        };
      });

      console.log('🎵 Processed songs with cover art:', newSongs);

      setSongs(newSongs);
      setStatus({ loading: false, loaded: true, error: null });
      
    } catch (err: any) {
      console.error("Podcast fetch failed:", err);
      
      let message = "Unable to load podcasts. Please check your internet connection and try again.";
      if (err.message.includes("All proxy attempts failed")) {
        message = "Network error. All connection attempts failed. Please check your internet connection.";
      } else if (err.message.includes("No podcast items")) {
        message = "No podcasts available at the moment.";
      } else if (err.message.includes("failed with status")) {
        message = "Server temporarily unavailable. Please try again later.";
      }

      setStatus({ loading: false, loaded: false, error: message });
      setToastMessage(message);
      setShowToast(true);
    }
  };

  useEffect(() => {
    fetchPodcastData();
  }, []);

  useEffect(() => {
    if (songs.length > 0) {
      try {
        Amplitude.init({
          songs,
          start_song: 0
        });
      } catch (error) {
        console.error('Error initializing Amplitude:', error);
      }
    }
  }, [songs]);

  const handleClick = () => {
    if (targetRef.current) {
      targetRef?.current?.scrollIntoView({ behavior: "smooth" });
    }
    setPlay(true);
  };

  const next = () => {
    setCurrentPage(p => Math.min(p + 1, totalPages));
    if (playlistRef.current) {
      playlistRef?.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const prev = () => {
    setCurrentPage(p => Math.max(p - 1, 1));
    if (playlistRef.current) {
      playlistRef?.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton></IonBackButton>
          </IonButtons>
          <IonTitle>Podcasts</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={doRefresh}>
          <IonRefresherContent
            className='custom-refresher-text !text-white'
            pullingIcon="chevron-down-circle-outline"
            pullingText="Pull to refresh"
            refreshingSpinner="circles"
            refreshingText="Refreshing..."
          />
        </IonRefresher>
        <div className='p-2'>
          <div className='mb-2 w-full rounded-2xl overflow-hidden bg-black max-h-max relative'>
            <img className='w-[200%]' src="./images/podcast.jpg" alt="" />
            <h3 className='p-3 font-headline text-center absolute bottom-0 text-white text-3xl font-bold'>Kingdom Lifestyle Podcast</h3>
          </div>

          {status.loading && (
            <div className='w-full min-h-[400px] flex justify-center items-center'>
              <div className='w-1/3'>
                <img src="./images/loader.gif" alt="" />
                <h4 className='text-center mt-2 text-blue-600'>Loading</h4>
              </div>
            </div>
          )}

          {status.loaded && (
            <div className="min-h-[60vh]">
              <div ref={targetRef} className="amplitude-player rounded-2xl overflow-clip">
                {/* Cover Art */}
                <img 
                  className='rounded-2xl w-full h-48 object-cover' 
                  data-amplitude-song-info="cover_art_url" 
                  alt="Album Art" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    console.warn('Cover art failed to load, using fallback:', target.src);
                    target.src = './images/podcast.jpg';
                  }}
                />

                <div className='bg-[#1f0d2a] text-white font-bold p-5 mt-2 rounded-2xl'>
                  <div className='flex gap-2 items-center'>
                    <span className="amplitude-current-time text-sm w-12"></span>
                    <input type="range" className="amplitude-song-slider w-full" />
                    <span className="amplitude-duration-time text-sm w-12"></span>
                  </div>

                  <div className='text-4xl justify-evenly flex mt-4'>
                    <button className="amplitude-prev hover:text-yellow-400 transition-colors">
                      <FontAwesomeIcon icon={faBackwardStep} />
                    </button>
                    <button 
                      onClick={() => setPlay(!play)} 
                      className="amplitude-play-pause hover:text-yellow-400 transition-colors"
                    >
                      {play ? (
                        <FontAwesomeIcon icon={faPauseCircle} />
                      ) : (
                        <FontAwesomeIcon icon={faPlayCircle} />
                      )}
                    </button>
                    <button className="amplitude-next hover:text-yellow-400 transition-colors">
                      <FontAwesomeIcon icon={faForwardStep} />
                    </button>
                  </div>
                </div>

                {/* Song Info */}
                <div className='p-3'>
                  <div className='flex items-end justify-end p-1 text-[purple] gap-2'>
                    <FontAwesomeIcon icon={faClock} />
                    <span className='font-semibold text-xs' data-amplitude-song-info="date"></span>
                  </div>
                  <span 
                    style={{ fontFamily: "Funnel Display" }}
                    className='font-semibold text-2xl block mt-2'
                    data-amplitude-song-info="title"
                  ></span>
                  <div 
                    style={{ fontFamily: "Funnel Display", marginTop: '10px' }}
                    className='text-sm text-[#5c5454] font-semibold line-clamp-3'
                    data-amplitude-song-info="description"
                  ></div>
                </div>
              </div>

              <div ref={playlistRef} className="playlist p-2">
                {currentItems.map((song: any, index: number) => (
                  <div
                    onClick={handleClick}
                    key={index}
                    className="song amplitude-play border p-3 mb-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    data-amplitude-song-index={index + ""}
                  >
                    <div className="flex items-start gap-3">
                      <img 
                        src={song.cover_art_url} 
                        alt={song.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = './images/podcast.jpg';
                        }}
                      />
                      <div className="flex-1">
                        <strong className='text-sm font-fancy block mb-1'>{song.title}</strong>
                        <p className='line-clamp-2 font-semibold text-[#928a8a] text-xs'>{song.description}</p>
                        <div className='flex justify-between items-center mt-2'>
                          <span className='text-xs text-purple-600'>{song.date}</span>
                          <span className='text-xs text-gray-400'>Click to play</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='flex justify-between p-2'>
                <button
                  className='bg-yellow-600 text-white font-semibold p-2 text-sm rounded disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2'
                  onClick={prev}
                  disabled={currentPage === 1}
                >
                  <FontAwesomeIcon icon={faArrowCircleLeft} />
                  Prev
                </button>

                <button className='text-sm text-gray-700 font-semibold'>
                  Page {currentPage} of {totalPages}
                </button>

                <button
                  className='bg-yellow-600 text-sm text-white font-semibold p-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2'
                  onClick={next}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <FontAwesomeIcon icon={faArrowCircleRight} />
                </button>
              </div>
            </div>
          )}

          {status.error && <Error />}
        </div>
      </IonContent>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={4000}
        position="bottom"
      />
    </IonPage>
  );
};

export default Podcast;
