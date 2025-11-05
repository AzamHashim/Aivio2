/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, LiveSession } from "@google/genai";

interface Comment {
  id: string;
  text: string;
}

interface Channel {
  id: string;
  name: string;
  subscriberCount: number;
}

const mockChannels: Channel[] = [
  { id: 'ch_alexdoe', name: 'Alex Doe Originals', subscriberCount: 125000 },
  { id: 'ch_nature', name: 'Nature Wonders', subscriberCount: 840000 },
  { id: 'ch_tech', name: 'TechExplained', subscriberCount: 230000 },
  { id: 'ch_gaming', name: 'Gaming Zone', subscriberCount: 560000 },
];

interface Monetization {
  type: 'free' | 'ppv' | 'subscription';
  price?: number;
}

interface Video {
  id: string;
  file: File;
  title: string;
  description: string;
  category: string;
  url: string;
  channelId: string;
  comments: Comment[];
  likes: number;
  isLiked: boolean;
  monetization: Monetization;
}

interface Notification {
  id: string;
  message: string;
}

interface User {
  name: string;
  username: string;
  subscribedChannelIds: string[];
  purchasedVideoIds: string[];
}

const App: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'live'>('home');
  const [user, setUser] = useState<User>({ name: 'Alex Doe', username: '@alexdoe', subscribedChannelIds: ['ch_tech', 'ch_gaming'], purchasedVideoIds: [] });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editUsername, setEditUsername] = useState(user.username);

  // Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [monetizationType, setMonetizationType] = useState<Monetization['type']>('free');
  const [price, setPrice] = useState('');

  const [newComment, setNewComment] = useState('');

  const [videoDescription, setVideoDescription] = useState('');
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoQuality, setVideoQuality] = useState('1080p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualityChangeIndicator, setQualityChangeIndicator] = useState('');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentItem, setPaymentItem] = useState<{ type: 'ppv' | 'subscription'; video?: Video; channel?: Channel } | null>(null);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState('');


  useEffect(() => {
    if (qualityChangeIndicator) {
      const timer = setTimeout(() => setQualityChangeIndicator(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [qualityChangeIndicator]);


  const showNotification = (message: string) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      message,
    };
    setNotifications(prev => [...prev, newNotification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 3000);
  };

  const handleUpload = (e: FormEvent) => {
    e.preventDefault();
    if (file && title && category) {
      const monetization: Monetization = {
        type: monetizationType,
        price: monetizationType === 'ppv' ? parseFloat(price) : undefined,
      };

      const newVideo: Video = {
        id: crypto.randomUUID(),
        file,
        title,
        description,
        category,
        url: URL.createObjectURL(file),
        channelId: 'ch_alexdoe', // All user uploads go to their own channel
        comments: [],
        likes: Math.floor(Math.random() * 5000) + 100, // Mock initial likes
        isLiked: false,
        monetization,
      };
      const updatedVideos = [...videos, newVideo];
      setVideos(updatedVideos);
      setCurrentVideo(newVideo);

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setFile(null);
      setMonetizationType('free');
      setPrice('');
      (document.getElementById('video-file') as HTMLInputElement).value = '';
      resetAIState();
    }
  };

  const handlePostComment = (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentVideo) return;

    const newCommentObj: Comment = {
      id: crypto.randomUUID(),
      text: newComment.trim(),
    };

    const updatedVideos = videos.map(video =>
      video.id === currentVideo.id
        ? { ...video, comments: [...video.comments, newCommentObj] }
        : video
    );

    setVideos(updatedVideos);
    setCurrentVideo(prev => prev ? { ...prev, comments: [...prev.comments, newCommentObj] } : null);
    setNewComment(''); // Reset input
  };

  const handleAnalyzeVideo = async () => {
    if (!videoDescription || !analysisPrompt) {
      setError('Please provide both a video description and an analysis prompt.');
      return;
    }
    setIsLoadingAI(true);
    setError(null);
    setAiResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const fullPrompt = `
        Based on the following video description, perform the requested analysis task.

        Video Description: "${videoDescription}"
        ---
        Analysis Task: "${analysisPrompt}"
      `;
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: fullPrompt,
      });

      setAiResult(response.text);
    } catch (err) {
      console.error("Gemini API Error:", err);
      setError("Failed to analyze video. Please check the console for details.");
    } finally {
      setIsLoadingAI(false);
    }
  };
  
  const resetAIState = () => {
    setAiResult(null);
    setVideoDescription('');
    setAnalysisPrompt('');
    setError(null);
  };

  const handleSubscribeToggle = (channelId: string) => {
      const isCurrentlySubscribed = user.subscribedChannelIds.includes(channelId);

      if (isCurrentlySubscribed) {
          // Unsubscribe logic
          const updatedSubscribedIds = user.subscribedChannelIds.filter(id => id !== channelId);
          setUser(prevUser => ({...prevUser, subscribedChannelIds: updatedSubscribedIds }));
          showNotification('Unsubscribed.');
      } else {
          // Initiate subscription purchase
          const channel = mockChannels.find(c => c.id === channelId);
          if(channel){
              setPaymentItem({ type: 'subscription', channel });
              setIsPaymentModalOpen(true);
          }
      }
  };


  const handleLikeToggle = () => {
    if (!currentVideo) return;

    const newLikedState = !currentVideo.isLiked;
    showNotification(newLikedState ? 'Video Liked!' : 'Like removed.');

    const updatedVideos = videos.map(video => {
      if (video.id === currentVideo.id) {
        const newLikes = newLikedState ? video.likes + 1 : video.likes - 1;
        return { ...video, isLiked: newLikedState, likes: newLikes };
      }
      return video;
    });

    setVideos(updatedVideos);
    setCurrentVideo(prev => {
      if (!prev) return null;
      const newLikes = newLikedState ? prev.likes + 1 : prev.likes - 1;
      return { ...prev, isLiked: newLikedState, likes: newLikes };
    });
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    setUser(prev => ({ ...prev, name: editName, username: editUsername }));
    setIsEditingProfile(false);
    showNotification('Profile updated!');
  };

  const handleCancelEdit = () => {
    setEditName(user.name);
    setEditUsername(user.username);
    setIsEditingProfile(false);
  };
  
  const handleQualityChange = (quality: string) => {
    setVideoQuality(quality);
    setShowQualityMenu(false);
    setQualityChangeIndicator(`Quality set to ${quality}`);
  };

  const handleInitiatePpvPurchase = (video: Video) => {
    setPaymentItem({ type: 'ppv', video });
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    // Delay resetting state to allow for fade-out animation
    setTimeout(() => {
        setPaymentItem(null);
        setPaymentState('idle');
        setPaymentError('');
    }, 300);
  };

  const handleConfirmPayment = (e: FormEvent) => {
      e.preventDefault();
      setPaymentState('processing');
      setPaymentError('');

      // Simulate API call
      setTimeout(() => {
          if (!paymentItem) return;

          // Simulate a random failure
          if (Math.random() < 0.1) {
              setPaymentState('error');
              setPaymentError('Payment declined. Please try another card.');
              return;
          }

          if (paymentItem.type === 'ppv' && paymentItem.video) {
              setUser(prev => ({
                  ...prev,
                  purchasedVideoIds: [...prev.purchasedVideoIds, paymentItem.video!.id]
              }));
          } else if (paymentItem.type === 'subscription' && paymentItem.channel) {
              setUser(prev => ({
                  ...prev,
                  subscribedChannelIds: [...prev.subscribedChannelIds, paymentItem.channel!.id]
              }));
          }
          setPaymentState('success');
          showNotification('Payment successful!');
          setTimeout(handleClosePaymentModal, 1500); // Close modal after showing success
      }, 2000);
  };

  // Custom Video Player Controls
  const togglePlayPause = () => {
    if (videoRef.current) {
        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
        setIsPlaying(!videoRef.current.paused);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (Number(e.target.value) / 100) * duration;
    if (videoRef.current) {
        videoRef.current.currentTime = newTime;
    }
    setProgress(Number(e.target.value));
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if(videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
    }
    setIsMuted(newVolume === 0);
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
        const newMutedState = !videoRef.current.muted;
        videoRef.current.muted = newMutedState;
        setIsMuted(newMutedState);
        if(!newMutedState && volume === 0) {
            setVolume(0.5); // Restore to a default volume if unmuting from 0
            videoRef.current.volume = 0.5;
        } else if (newMutedState) {
            setVolume(0);
        }
    }
  };
  
  const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

    // ********** START: Audio Helper Functions for Live **********
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };
  
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };
  // ********** END: Audio Helper Functions for Live **********

  const renderHomeView = () => {
      const channel = currentVideo ? mockChannels.find(c => c.id === currentVideo.channelId) : null;
      const isSubscribedToCurrentChannel = currentVideo ? user.subscribedChannelIds.includes(currentVideo.channelId) : false;

      const hasAccess = currentVideo ? 
        currentVideo.monetization.type === 'free' ||
        (currentVideo.monetization.type === 'ppv' && user.purchasedVideoIds.includes(currentVideo.id)) ||
        (currentVideo.monetization.type === 'subscription' && isSubscribedToCurrentChannel)
        : false;

      return (
      <main>
        <div className="main-column">
          <div className="video-player-container">
            {currentVideo ? (
              <>
                {hasAccess ? (
                  <>
                    <video 
                        ref={videoRef}
                        src={currentVideo.url} 
                        autoPlay 
                        key={currentVideo.id}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => {
                            setCurrentTime(e.currentTarget.currentTime);
                            setProgress((e.currentTarget.currentTime / duration) * 100);
                        }}
                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        onVolumeChange={(e) => {
                            setVolume(e.currentTarget.volume);
                            setIsMuted(e.currentTarget.muted);
                        }}
                        onClick={togglePlayPause}
                    ></video>
                    {qualityChangeIndicator && <div className="quality-indicator">{qualityChangeIndicator}</div>}
                    <div className="video-controls-overlay">
                        <div className="progress-bar-container">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={progress || 0}
                            onChange={handleProgressChange}
                            className="progress-bar"
                            style={{'--progress-percent': `${progress}%`} as React.CSSProperties}
                            />
                        </div>
                        <div className="controls-bottom-row">
                            <div className="controls-left">
                               <button className="control-btn" onClick={togglePlayPause}>
                                {isPlaying ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z"></path></svg>
                                )}
                               </button>
                               <div className="volume-container">
                                <button className="control-btn" onClick={toggleMute}>
                                    {isMuted || volume === 0 ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"></path></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c3.89-.91 7-4.49 7-8.77s-3.11-7.86-7-8.77z"></path></svg>
                                    )}
                                </button>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={isMuted ? 0 : volume} 
                                    onChange={handleVolumeChange} 
                                    className="volume-slider" 
                                    style={{'--volume-percent': `${isMuted ? 0 : volume * 100}%`} as React.CSSProperties}
                                />
                               </div>
                            </div>
                             <div className="controls-right">
                                <span className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
                                <div className="settings-container">
                                    <button className="control-btn settings-btn" onClick={() => setShowQualityMenu(prev => !prev)} aria-label="Video settings">
                                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
                                    </button>
                                    {showQualityMenu && (
                                        <ul className="quality-menu">
                                            <li onClick={() => handleQualityChange('1080p')} className={videoQuality === '1080p' ? 'active' : ''}>1080p (High)</li>
                                            <li onClick={() => handleQualityChange('720p')} className={videoQuality === '720p' ? 'active' : ''}>720p (Medium)</li>
                                            <li onClick={() => handleQualityChange('480p')} className={videoQuality === '480p' ? 'active' : ''}>480p (Low)</li>
                                        </ul>
                                    )}
                                </div>
                             </div>
                        </div>
                    </div>
                  </>
                ) : (
                    <div className="video-lock-overlay">
                        <div className="lock-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 0 24 24" width="48"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"></path></svg>
                        </div>
                        <h3>Premium Content</h3>
                        {currentVideo.monetization.type === 'ppv' && (
                            <>
                                <p>Unlock this video for a one-time payment.</p>
                                <button onClick={() => handleInitiatePpvPurchase(currentVideo)}>
                                    Buy Now for ${currentVideo.monetization.price?.toFixed(2)}
                                </button>
                            </>
                        )}
                        {currentVideo.monetization.type === 'subscription' && channel && (
                            <>
                                <p>Subscribe to {channel.name} to watch.</p>
                                <button onClick={() => handleSubscribeToggle(currentVideo.channelId)}>
                                    Subscribe to Watch
                                </button>
                            </>
                        )}
                    </div>
                )}
              </>
            ) : (
              <div className="no-video-placeholder">
                <p>Upload a video to start watching</p>
              </div>
            )}
          </div>
          {currentVideo ? (
            <>
              <div className="video-info">
                <div className="video-meta">
                   <div className="title-line">
                    <h3>{currentVideo.title}</h3>
                    {currentVideo.monetization.type !== 'free' && (
                        <span className="premium-badge">
                            {currentVideo.monetization.type === 'ppv' ? `$${currentVideo.monetization.price?.toFixed(2)}` : 'Premium'}
                        </span>
                    )}
                  </div>
                  <p className="video-category">{currentVideo.category}</p>
                  <p className="video-channel-name">{channel ? channel.name : 'Unknown Channel'}</p>
                  <p>{currentVideo.description}</p>
                </div>
                <div className="video-actions">
                  <button 
                    className={`like-btn ${currentVideo.isLiked ? 'liked' : ''}`} 
                    onClick={handleLikeToggle}
                    aria-label="Like video"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path></svg>
                    <span>{currentVideo.likes.toLocaleString()}</span>
                  </button>
                  <button
                    className={`subscribe-btn ${isSubscribedToCurrentChannel ? 'subscribed' : ''}`}
                    onClick={() => handleSubscribeToggle(currentVideo.channelId)}
                  >
                    {isSubscribedToCurrentChannel ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              </div>

              <div className="card comments-section">
                <h4>Comments ({currentVideo.comments.length})</h4>
                <form className="comment-form" onSubmit={handlePostComment}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    required
                  />
                  <button type="submit" disabled={!newComment.trim()}>Post</button>
                </form>
                <ul className="comments-list">
                  {currentVideo.comments.length > 0 ? (
                    currentVideo.comments.map(comment => (
                      <li key={comment.id}>{comment.text}</li>
                    ))
                  ) : (
                    <p className="no-comments">No comments yet. Be the first to comment!</p>
                  )}
                </ul>
              </div>

              <div className="card ai-analysis">
                <h2>🤖 AI Content Analysis</h2>
                 <div className="form-group">
                    <label htmlFor="ai-model">Analysis Model</label>
                    <select id="ai-model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
                    </select>
                </div>
                <div className="form-group">
                  <label htmlFor="video-description">Describe the video content for AI</label>
                  <textarea
                    id="video-description"
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    placeholder="e.g., A golden retriever playing fetch with a red ball in a sunny park."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="analysis-prompt">Analysis Prompt</label>
                  <textarea
                    id="analysis-prompt"
                    value={analysisPrompt}
                    onChange={(e) => setAnalysisPrompt(e.target.value)}
                    placeholder="e.g., Generate a title, summary, and 5 tags."
                  />
                </div>
                <div className="prompt-suggestions">
                    <strong>Prompt Suggestions:</strong>
                    <ul>
                        <li>Generate a title, summary, and tags.</li>
                        <li>Create a script outline for this video.</li>
                        <li>Identify key moments and suggest timestamps.</li>
                        <li>Write a social media post to promote this video.</li>
                    </ul>
                </div>
                <button onClick={handleAnalyzeVideo} disabled={isLoadingAI || !videoDescription || !analysisPrompt}>
                  {isLoadingAI ? 'Analyzing...' : 'Analyze with Gemini'}
                </button>
                {error && <p className="error-message">{error}</p>}
                {isLoadingAI && (
                    <div className="loader">
                        <div className="loader-spinner"></div>
                    </div>
                )}
                {aiResult && (
                  <div className="ai-result">
                    <h4>Analysis Result</h4>
                    <pre className="ai-result-text">{aiResult}</pre>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
        <div className="sidebar-column">
          <div className="card upload-form">
            <h2>Upload Video</h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label htmlFor="video-file">Video File</label>
                <input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., My Awesome Vacation"
                  required
                />
              </div>
               <div className="form-group">
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Gaming, Travel, Tech"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your video"
                />
              </div>
               <div className="form-group">
                  <label>Monetization</label>
                  <div className="monetization-options">
                      <label>
                          <input type="radio" name="monetization" value="free" checked={monetizationType === 'free'} onChange={() => setMonetizationType('free')} />
                          Free
                      </label>
                      <label>
                          <input type="radio" name="monetization" value="ppv" checked={monetizationType === 'ppv'} onChange={() => setMonetizationType('ppv')} />
                          Pay-Per-View
                      </label>
                      <label>
                          <input type="radio" name="monetization" value="subscription" checked={monetizationType === 'subscription'} onChange={() => setMonetizationType('subscription')} />
                          Subscription Only
                      </label>
                  </div>
                  {monetizationType === 'ppv' && (
                      <div className="price-input-container">
                          <label htmlFor="price">Price ($)</label>
                          <input
                              id="price"
                              type="number"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              placeholder="e.g., 2.99"
                              min="0.50"
                              step="0.01"
                              required
                          />
                      </div>
                  )}
              </div>
              <button type="submit" disabled={!file || !title || !category || (monetizationType === 'ppv' && !price)}>
                Upload & Play
              </button>
            </form>
          </div>
          {videos.length > 0 && (
            <div className="card video-list">
              <h2>My Videos</h2>
              <ul>
                {filteredVideos.map((video) => (
                  <li
                    key={video.id}
                    className={currentVideo?.id === video.id ? 'active' : ''}
                    onClick={() => {
                        setCurrentVideo(video);
                        resetAIState();
                    }}
                  >
                    <div className="video-list-item">
                      {video.monetization.type !== 'free' && (
                        <span className="monetization-icon" title={video.monetization.type === 'ppv' ? `Pay-per-view ($${video.monetization.price?.toFixed(2)})` : 'Subscription only'}>
                          <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.65 1.35-3 3-3s3 1.35 3 3v2H9z"></path></svg>
                        </span>
                      )}
                      <span className="video-list-title">{video.title}</span>
                      <span className="video-list-category">{video.category}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    );
  }

  const renderProfileView = () => (
    <main className="profile-page">
      <div className="profile-content">
        <button className="back-btn" onClick={() => setCurrentView('home')}>&larr; Back to Home</button>
        <div className="card profile-card">
          <h2>My Profile</h2>
          {isEditingProfile ? (
            <form className="edit-profile-form" onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label htmlFor="edit-name">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />
              </div>
              <div className="edit-profile-actions">
                <button type="submit">Save</button>
                <button type="button" className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <div className="profile-details">
                <p className="profile-name">{user.name}</p>
                <p className="profile-username">{user.username}</p>
              </div>
              <button className="edit-btn" onClick={() => setIsEditingProfile(true)}>Edit Profile</button>
            </div>
          )}
        </div>
         <div className="card subscriptions">
            <h2>My Subscriptions ({user.subscribedChannelIds.length})</h2>
            {user.subscribedChannelIds.length > 0 ? (
                <ul>
                    {user.subscribedChannelIds.map(channelId => {
                        const channel = mockChannels.find(c => c.id === channelId);
                        return channel ? <li key={channel.id}>{channel.name}</li> : null;
                    })}
                </ul>
            ) : (
                <p className="no-videos">You haven't subscribed to any channels yet.</p>
            )}
        </div>
        <div className="card user-videos">
          <h2>My Uploads ({videos.length})</h2>
          {videos.length > 0 ? (
            <ul>
              {videos.map(video => (
                <li key={video.id}>
                  <div className="video-list-item">
                    <span className="video-list-title">{video.title}</span>
                    <span className="video-list-category">{video.category}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-videos">You haven't uploaded any videos yet.</p>
          )}
        </div>
      </div>
    </main>
  );

  const LiveView: React.FC = () => {
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [history, setHistory] = useState<{ author: 'You' | 'Gemini', text: string }[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');

    const sessionRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const cleanupAudio = () => {
        if (scriptProcessorRef.current && mediaStreamSourceRef.current) {
            scriptProcessorRef.current.disconnect();
            mediaStreamSourceRef.current.disconnect();
            scriptProcessorRef.current = null;
            mediaStreamSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
    };
    
    const stopLiveSession = async () => {
        if (sessionRef.current) {
            const session = await sessionRef.current;
            session.close();
            sessionRef.current = null;
        }
        cleanupAudio();
        setConnectionState('disconnected');
        setCurrentInput('');
        setCurrentOutput('');
    };

    const startLiveSession = async () => {
        setConnectionState('connecting');
        setErrorMessage(null);
        setHistory([]);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // FIX: Cast window to `any` to allow access to the vendor-prefixed `webkitAudioContext` for broader browser compatibility.
            inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // FIX: Cast window to `any` to allow access to the vendor-prefixed `webkitAudioContext` for broader browser compatibility.
            outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            sessionRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionRef.current) {
                                sessionRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        let tempInput = '';
                        if (message.serverContent?.inputTranscription) {
                            tempInput = message.serverContent.inputTranscription.text;
                            setCurrentInput(prev => prev + tempInput);
                        }
                        
                        let tempOutput = '';
                        if (message.serverContent?.outputTranscription) {
                            tempOutput = message.serverContent.outputTranscription.text;
                            setCurrentOutput(prev => prev + tempOutput);
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInput + tempInput;
                            const fullOutput = currentOutput + tempOutput;
                            
                            setHistory(prev => [
                                ...prev,
                                { author: 'You', text: fullInput },
                                { author: 'Gemini', text: fullOutput }
                            ]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            const outputAudioContext = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Gemini Live Error:', e);
                        setErrorMessage('An error occurred with the live session. Please try again.');
                        setConnectionState('error');
                        cleanupAudio();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Gemini Live session closed');
                        setConnectionState('disconnected');
                        cleanupAudio();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                },
            });

        } catch (err) {
            console.error("Failed to start live session:", err);
            setErrorMessage("Could not access microphone. Please grant permission and try again.");
            setConnectionState('error');
        }
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionRef.current) {
                stopLiveSession();
            }
        };
    }, []);
    
    const renderStatusIndicator = () => {
        let color, text;
        switch(connectionState) {
            case 'connected': color = 'var(--success-color)'; text = 'Connected'; break;
            case 'connecting': color = '#f0ad4e'; text = 'Connecting...'; break;
            case 'error': color = 'var(--error-color)'; text = 'Error'; break;
            case 'disconnected':
            default: color = 'var(--secondary-text)'; text = 'Disconnected'; break;
        }
        return (
            <div className="live-status">
                <span className="status-dot" style={{ backgroundColor: color }}></span>
                <span>{text}</span>
            </div>
        );
    };

    return (
        <main className="live-page">
            <div className="live-content">
                <button className="back-btn" onClick={() => setCurrentView('home')}>&larr; Back to Home</button>
                <div className="card live-card">
                    <div className="live-header">
                        <h2>🤖 Live AI Conversation</h2>
                        {renderStatusIndicator()}
                    </div>
                    <div className="transcription-area">
                        {history.length === 0 && connectionState === 'disconnected' && !currentInput && !currentOutput &&(
                            <p className="no-transcription">Click "Start Live Chat" to begin a conversation.</p>
                        )}
                        <div className="transcription-history">
                            {history.map((entry, index) => (
                                <div key={index} className={`chat-bubble ${entry.author === 'You' ? 'user-bubble' : 'gemini-bubble'}`}>
                                    <strong>{entry.author}:</strong> {entry.text}
                                </div>
                            ))}
                        </div>
                         {(currentInput || currentOutput) && (
                            <div className="live-transcription">
                                {currentInput && <div className="chat-bubble user-bubble live-bubble"><strong>You:</strong> {currentInput}<span className="caret"></span></div>}
                                {currentOutput && <div className="chat-bubble gemini-bubble live-bubble"><strong>Gemini:</strong> {currentOutput}<span className="caret"></span></div>}
                            </div>
                        )}
                    </div>
                     <div className="live-controls">
                        {connectionState !== 'connected' && connectionState !== 'connecting' ? (
                            <button onClick={startLiveSession} disabled={connectionState === 'connecting'}>
                                {connectionState === 'connecting' ? 'Starting...' : 'Start Live Chat'}
                            </button>
                        ) : (
                            <button onClick={stopLiveSession} className="stop-btn">
                                Stop Live Chat
                            </button>
                        )}
                        {errorMessage && <p className="error-message">{errorMessage}</p>}
                    </div>
                </div>
            </div>
        </main>
    );
  };
  
  const renderPaymentModal = () => {
    if (!isPaymentModalOpen || !paymentItem) return null;

    const getItemDetails = () => {
        if (paymentItem.type === 'ppv' && paymentItem.video) {
            return {
                title: 'Unlock Video',
                description: `You are purchasing "${paymentItem.video.title}".`,
                price: paymentItem.video.monetization.price,
            };
        }
        if (paymentItem.type === 'subscription' && paymentItem.channel) {
            return {
                title: 'Subscribe to Channel',
                description: `You are subscribing to "${paymentItem.channel.name}".`,
                price: 4.99, // Mock subscription price
            };
        }
        return { title: 'Confirm Purchase', description: '', price: 0 };
    };

    const { title, description, price } = getItemDetails();

    return (
        <div className="payment-modal-backdrop" onClick={handleClosePaymentModal}>
            <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                <div className="payment-modal-header">
                    <h3>{title}</h3>
                    <button className="close-btn" onClick={handleClosePaymentModal} aria-label="Close payment modal">&times;</button>
                </div>
                {paymentState === 'idle' && (
                  <form onSubmit={handleConfirmPayment}>
                      <div className="payment-modal-body">
                          <p>{description}</p>
                          <div className="price-display">
                              Total: <span>${price?.toFixed(2)}</span>
                          </div>
                          <div className="form-group">
                              <label htmlFor="card-number">Card Number</label>
                              <input id="card-number" type="text" placeholder="**** **** **** 1234" required />
                          </div>
                          <div className="form-row">
                              <div className="form-group">
                                  <label htmlFor="expiry">Expiry Date</label>
                                  <input id="expiry" type="text" placeholder="MM/YY" required />
                              </div>
                              <div className="form-group">
                                  <label htmlFor="cvc">CVC</label>
                                  <input id="cvc" type="text" placeholder="123" required />
                              </div>
                          </div>
                      </div>
                      <div className="payment-modal-footer">
                          <button type="submit" className="pay-btn">Pay ${price?.toFixed(2)}</button>
                      </div>
                  </form>
                )}
                {paymentState === 'processing' && (
                    <div className="payment-modal-body state-screen">
                        <div className="loader-spinner"></div>
                        <p>Processing your payment...</p>
                    </div>
                )}
                 {paymentState === 'success' && (
                    <div className="payment-modal-body state-screen">
                        <div className="success-icon">&#10004;</div>
                        <p>Payment Successful!</p>
                    </div>
                )}
                {paymentState === 'error' && (
                    <div className="payment-modal-body state-screen">
                        <div className="error-icon">&times;</div>
                        <p className="error-message">{paymentError}</p>
                        <button onClick={() => setPaymentState('idle')}>Try Again</button>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <>
      {renderPaymentModal()}
      <div className="notification-container">
        {notifications.map(notification => (
          <div key={notification.id} className="notification-toast">
            {notification.message}
          </div>
        ))}
      </div>
      <header>
        <h1 onClick={() => setCurrentView('home')} style={{cursor: 'pointer'}}>Aivio</h1>
        <div className="header-right">
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search videos by title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <button className="profile-btn" onClick={() => setCurrentView('live')}>Live Chat</button>
            <button className="profile-btn" onClick={() => setCurrentView('profile')}>Profile</button>
        </div>
      </header>
      {currentView === 'home' && renderHomeView()}
      {currentView === 'profile' && renderProfileView()}
      {currentView === 'live' && <LiveView />}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);