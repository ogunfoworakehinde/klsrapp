import React, { useEffect, useRef, useState } from 'react';
import XMLParser from 'react-xml-parser';
import 'react-h5-audio-player/lib/styles.css';
import Amplitude from "amplitudejs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowCircleLeft, faArrowCircleRight, faBackwardStep, faClock, faForwardStep, faPauseCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";

import {
  IonPage,
  IonBackButton,
  IonButtons,
  IonHeader,
  IonContent,
  IonToolbar,
  IonTitle,
  IonRefresher,
  IonRefresherContent,
  IonToast,
  IonLoading
} from '@ionic/react';

import { RefresherEventDetail } from '@ionic/core';
import Error from '../components/Error';

const Podcast = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<any>(null);
  const [currentPodcast, setCurrentPodcast] = useState(0);
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

  // Updated CORS proxy options - using more reliable ones
  const PROXY_OPTIONS = [
    {
      name: 'corsproxy',
      url: (targetUrl: string) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    },
    {
      name: 'allorigins',
      url: (targetUrl: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&callback=?`
    },
    {
      name: 'public-cors',
      url: (targetUrl: string) => `https://public.cors.workers.dev/?${encodeURIComponent(targetUrl)}`
    },
    {
      name: 'direct',
      url: (targetUrl: string) => targetUrl
    }
  ];

  const fetchWithProxy = async (url: string, proxyIndex = 0): Promise<any> => {
    if (proxyIndex >= PROXY_OPTIONS.length) {
      throw new Error('All proxy attempts failed');
    }

    try {
      const proxy = PROXY_OPTIONS[proxyIndex];
      console.log(`Trying proxy: ${proxy.name}`);
      
      const proxyUrl = proxy.url(url);
      console.log(`Proxy URL: ${proxyUrl}`);
      
      let response;
      
      if (proxy.name === 'allorigins') {
        // AllOrigins returns JSON with contents field
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/xml, */*',
          }
        });
        
        if (!response.ok) {
          throw new Error(`AllOrigins failed: ${response.status}`);
        }
        
        const data = await response.json();
        // Create a mock response object with the contents
        return {
          ok: true,
          text: () => Promise.resolve(data.contents)
        };
      } else {
        // For other proxies
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/rss+xml, text/xml, */*',
            'User-Agent': 'Mozilla/5.0 (compatible; MyApp/1.0)'
          }
        });

        if (!response.ok) {
          throw new Error(`Proxy ${proxy.name} failed: ${response.status}`);
        }

        console.log(`✓ Proxy ${proxy.name} succeeded`);
        return response;
      }
    } catch (error) {
      console.warn(`✗ Proxy ${PROXY_OPTIONS[proxyIndex].name} failed:`, error);
      
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
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) {
        return 'Recent';
      }
      const pad = (n: number) => n.toString().padStart(2, '0');
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${pad(date.getFullYear() % 100)} ${pad(hours)}:${pad(date.getMinutes())}${ampm}`;
    } catch {
      return 'Recent';
    }
  };

  const fetchPodcastData = async () => {
    setStatus({ loading: true, loaded: false, error: null });
    setLoading(true);

    try {
      console.log('Starting podcast fetch...');
      
      const rssUrl = 'https://anchor.fm/s/1d6ad87c/podcast/rss';
      
      // Try local cache first
      const cacheKey = 'podcast_cache';
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          console.log('Using cached data');
          setSongs(data);
          setStatus({ loading: false, loaded: true, error: null });
          setLoading(false);
          return;
        }
      }
      
      // Use proxy to fetch
      const response = await fetchWithProxy(rssUrl);
      
      const str = await response.text();
      console.log('RSS feed fetched successfully, length:', str.length);

      // Check if we got valid XML
      if (!str.includes('<rss') || str.trim() === '') {
        throw new Error('Invalid RSS feed received');
      }

      const xml = new XMLParser().parseFromString(str);
      const items = xml.getElementsByTagName("item");
      
      if (!items || items.length === 0) {
        // Try alternative parsing method
        const channel = xml.getElementsByTagName("channel");
        if (channel && channel[0] && channel[0].children) {
          const channelChildren = channel[0].children;
          const foundItems = channelChildren.filter((child: any) => child.name === "item");
          if (foundItems.length > 0) {
            items = foundItems;
          }
        }
      }
      
      if (!items || items.length === 0) {
        throw new Error('No podcast items found in RSS feed');
      }
      
      console.log(`Found ${items.length} podcast items`);

      // Parse items
      const newSongs = items.map((ele: any, index: number) => {
        const children = ele.children || [];
        
        // Find elements by name
        const findElement = (name: string) => {
          return children.find((child: any) => child.name === name);
        };

        const titleElem = findElement('title');
        const enclosureElem = findElement('enclosure');
        const pubDateElem = findElement('pubDate');
        const descriptionElem = findElement('description');
        const itunesImageElem = findElement('itunes:image');
        
        // Get cover art URL
        let cover_art_url = itunesImageElem?.attributes?.href;
        
        // If no cover art found, try alternative locations
        if (!cover_art_url) {
          const imageElem = findElement('image');
          if (imageElem?.attributes?.href) {
            cover_art_url = imageElem.attributes.href;
          } else if (imageElem?.children) {
            const urlElem = imageElem.children.find((c: any) => c.name === 'url');
            if (urlElem?.value) {
              cover_art_url = urlElem.value;
            }
          }
        }

        const title = titleElem?.value?.replace(/[<>]/g, "") || `Episode ${index + 1}`;
        const url = enclosureElem?.attributes?.url || '';
        const date = formatDate(pubDateElem?.value || '');
        const description = descriptionElem?.value?.replace(/<[^>]+>/g, " ").trim() || 'No description available';
        
        // Truncate description
        const shortDescription = description.length > 150 
          ? description.substring(0, 150) + '...' 
          : description;

        return {
          id: index,
          title: title,
          url: url,
          date: date,
          cover_art_url: cover_art_url || './images/podcast.jpg',
          description: shortDescription,
          fullDescription: description
        };
      }).filter((song: any) => song.url); // Only include songs with audio URL

      console.log(`Processed ${newSongs.length} valid songs`);

      if (newSongs.length === 0) {
        throw new Error('No valid podcast episodes found');
      }

      setSongs(newSongs);
      
      // Cache the data
      localStorage.setItem(cacheKey, JSON.stringify({
        data: newSongs,
        timestamp: Date.now()
      }));
      
      setStatus({ loading: false, loaded: true, error: null });
      
    } catch (err: any) {
      console.error("Podcast fetch failed:", err);
      
      // Try to load from cache even if expired
      const cacheKey = 'podcast_cache';
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        console.log('Using expired cache as fallback');
        setSongs(data);
        setStatus({ loading: false, loaded: true, error: null });
        setToastMessage('Using cached data. Check your connection.');
        setShowToast(true);
      } else {
        let message = "Unable to load podcasts. Please check your internet connection.";
        if (err.message.includes("All proxy attempts failed")) {
          message = "Network error. Please check your connection.";
        } else if (err.message.includes("No podcast items")) {
          message = "No podcasts available at the moment.";
        }

        setStatus({ loading: false, loaded: false, error: message });
        setToastMessage(message);
        setShowToast(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPodcastData();
  }, []);

  useEffect(() => {
    if (songs.length > 0 && status.loaded) {
      try {
        console.log('Initializing Amplitude with', songs.length, 'songs');
        
        // Stop any existing Amplitude instance
        if (Amplitude.getActivePlaylist() !== null) {
          Amplitude.stop();
        }
        
        // Initialize Amplitude
        Amplitude.init({
          songs: songs,
          start_song: currentPodcast,
          debug: false,
          callbacks: {
            play: () => {
              console.log('Playback started');
              setIsPlaying(true);
            },
            pause: () => {
              console.log('Playback paused');
              setIsPlaying(false);
            },
            stop: () => {
              console.log('Playback stopped');
              setIsPlaying(false);
            },
            song_change: (song: any) => {
              console.log('Song changed to:', song.title);
              setCurrentPodcast(song.index);
            },
            time_update: () => {
              // Update progress if needed
            }
          },
          volume: 100
        });
        
        // Bind elements after initialization
        setTimeout(() => {
          Amplitude.bindNewElements();
          console.log('Amplitude initialized successfully');
        }, 100);
        
      } catch (error) {
        console.error('Error initializing Amplitude:', error);
      }
    }
  }, [songs, status.loaded]);

  const handleClick = (index: number) => {
    if (targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth" });
    }
    
    // Play the selected song
    Amplitude.playSongAtIndex(index);
    setCurrentPodcast(index);
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      Amplitude.pause();
    } else {
      Amplitude.play();
    }
    setIsPlaying(!isPlaying);
  };

  const next = () => {
    setCurrentPage(p => Math.min(p + 1, totalPages));
    if (playlistRef.current) {
      playlistRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const prev = () => {
    setCurrentPage(p => Math.max(p - 1, 1));
    if (playlistRef.current) {
      playlistRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const playNextSong = () => {
    Amplitude.next();
  };

  const playPrevSong = () => {
    Amplitude.prev();
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
            <img 
              className='w-full h-48 object-cover' 
              src="./images/podcast.jpg" 
              alt="Podcast Background" 
            />
            <h3 className='p-3 font-headline text-center absolute bottom-0 text-white text-3xl font-bold w-full bg-gradient-to-t from-black to-transparent'>
              Kingdom Lifestyle Podcast
            </h3>
          </div>

          <IonLoading isOpen={loading && !status.loaded} message="Loading podcasts..." />

          {status.loading && (
            <div className='w-full min-h-[400px] flex justify-center items-center'>
              <div className='w-1/3'>
                <img src="./images/loader.gif" alt="" />
                <h4 className='text-center mt-2 text-blue-600'>Loading</h4>
              </div>
            </div>
          )}

          {status.loaded && songs.length > 0 && (
            <div className="min-h-[60vh]">
              {/* Player Section */}
              <div ref={targetRef} className="amplitude-player rounded-2xl overflow-clip bg-white shadow-lg">
                {/* Cover Art */}
                <img 
                  className='rounded-2xl w-full h-48 object-cover' 
                  data-amplitude-song-info="cover_art_url" 
                  alt="Album Art" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = './images/podcast.jpg';
                  }}
                />

                {/* Player Controls */}
                <div className='bg-gradient-to-r from-purple-800 to-purple-600 text-white p-4 mt-2'>
                  <div className='flex gap-2 items-center mb-4'>
                    <span className="amplitude-current-time text-sm w-12">0:00</span>
                    <input 
                      type="range" 
                      className="amplitude-song-slider w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer" 
                      style={{ accentColor: '#fbbf24' }}
                    />
                    <span className="amplitude-duration-time text-sm w-12">0:00</span>
                  </div>

                  <div className='flex justify-center items-center gap-8 text-4xl'>
                    <button 
                      className="amplitude-prev hover:text-yellow-400 transition-colors"
                      onClick={playPrevSong}
                    >
                      <FontAwesomeIcon icon={faBackwardStep} />
                    </button>
                    <button 
                      className="amplitude-play-pause hover:text-yellow-400 transition-colors"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? (
                        <FontAwesomeIcon icon={faPauseCircle} />
                      ) : (
                        <FontAwesomeIcon icon={faPlayCircle} />
                      )}
                    </button>
                    <button 
                      className="amplitude-next hover:text-yellow-400 transition-colors"
                      onClick={playNextSong}
                    >
                      <FontAwesomeIcon icon={faForwardStep} />
                    </button>
                  </div>
                </div>

                {/* Song Info */}
                <div className='p-4'>
                  <div className='flex items-center justify-end p-1 text-purple-600 gap-2'>
                    <FontAwesomeIcon icon={faClock} />
                    <span className='font-semibold text-xs amplitude-song-info' data-amplitude-song-info="date"></span>
                  </div>
                  <h2 
                    className='font-semibold text-xl block mt-2 line-clamp-2'
                    data-amplitude-song-info="title"
                  ></h2>
                  <p 
                    className='text-sm text-gray-600 font-medium mt-2 line-clamp-3'
                    data-amplitude-song-info="description"
                  ></p>
                </div>
              </div>

              {/* Podcast List */}
              <div ref={playlistRef} className="playlist p-2 mt-6">
                <h3 className='text-lg font-bold mb-4 text-gray-800'>All Episodes ({songs.length})</h3>
                
                {currentItems.map((song: any, index: number) => (
                  <div
                    onClick={() => handleClick(song.id)}
                    key={song.id}
                    className={`song amplitude-play border p-3 mb-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${currentPodcast === song.id ? 'bg-yellow-50 border-yellow-200' : ''}`}
                    data-amplitude-song-index={song.id}
                  >
                    <div className="flex items-start gap-3">
                      <img 
                        src={song.cover_art_url} 
                        alt={song.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = './images/podcast.jpg';
                        }}
                      />
                      <div className="flex-1">
                        <strong className='text-sm font-semibold block mb-1 text-gray-800'>
                          {song.title}
                          {currentPodcast === song.id && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Now Playing
                            </span>
                          )}
                        </strong>
                        <p className='line-clamp-2 text-gray-600 text-xs mb-2'>{song.description}</p>
                        <div className='flex justify-between items-center'>
                          <span className='text-xs text-purple-600 font-medium'>{song.date}</span>
                          <span className='text-xs text-gray-500'>
                            {currentPodcast === song.id && isPlaying ? 'Playing...' : 'Click to play'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex justify-between items-center p-4 border-t'>
                  <button
                    className='bg-purple-600 text-white font-semibold px-4 py-2 text-sm rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-purple-700 transition'
                    onClick={prev}
                    disabled={currentPage === 1}
                  >
                    <FontAwesomeIcon icon={faArrowCircleLeft} />
                    Prev
                  </button>

                  <span className='text-sm text-gray-700 font-medium'>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    className='bg-purple-600 text-white font-semibold px-4 py-2 text-sm rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-purple-700 transition'
                    onClick={next}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <FontAwesomeIcon icon={faArrowCircleRight} />
                  </button>
                </div>
              )}
            </div>
          )}

          {status.error && !loading && (
            <div className="mt-8">
              <Error />
              <div className="text-center mt-4">
                <button
                  onClick={fetchPodcastData}
                  className="bg-purple-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-purple-700 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!status.loaded && !status.error && !loading && songs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No podcasts available. Pull down to refresh.</p>
            </div>
          )}
        </div>
      </IonContent>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="bottom"
        color={status.error ? 'danger' : 'primary'}
      />
    </IonPage>
  );
};

export default Podcast;
