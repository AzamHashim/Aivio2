/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

interface Comment {
  id: string;
  text: string;
}

interface Video {
  id: string;
  file: File;
  title: string;
  description: string;
  category: string;
  url: string;
  isSubscribed: boolean;
  comments: Comment[];
  likes: number;
  isLiked: boolean;
}

interface Notification {
  id: string;
  message: string;
}

interface User {
  name: string;
  username: string;
}

const App: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'profile'>('home');
  const [user, setUser] = useState<User>({ name: 'Alex Doe', username: '@alexdoe' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editUsername, setEditUsername] = useState(user.username);


  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [newComment, setNewComment] = useState('');

  const [videoDescription, setVideoDescription] = useState('');
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video player state
  const [videoQuality, setVideoQuality] = useState('1080p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualityChangeIndicator, setQualityChangeIndicator] = useState('');


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
      const newVideo: Video = {
        id: crypto.randomUUID(),
        file,
        title,
        description,
        category,
        url: URL.createObjectURL(file),
        isSubscribed: false,
        comments: [],
        likes: Math.floor(Math.random() * 5000) + 100, // Mock initial likes
        isLiked: false,
      };
      const updatedVideos = [...videos, newVideo];
      setVideos(updatedVideos);
      setCurrentVideo(newVideo);

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setFile(null);
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

  const handleSubscribeToggle = () => {
    if (!currentVideo) return;
    
    const newSubState = !currentVideo.isSubscribed;
    showNotification(newSubState ? 'Subscribed!' : 'Unsubscribed.');

    const updatedVideos = videos.map(video =>
      video.id === currentVideo.id
        ? { ...video, isSubscribed: newSubState }
        : video
    );

    setVideos(updatedVideos);
    setCurrentVideo(prev => prev ? { ...prev, isSubscribed: newSubState } : null);
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
    setUser({ name: editName, username: editUsername });
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


  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHomeView = () => (
      <main>
        <div className="main-column">
          <div className="video-player-container">
            {currentVideo ? (
              <>
                <video src={currentVideo.url} controls autoPlay key={currentVideo.id}></video>
                {qualityChangeIndicator && <div className="quality-indicator">{qualityChangeIndicator}</div>}
                <div className="video-controls-overlay">
                    {showQualityMenu && (
                        <ul className="quality-menu">
                            <li onClick={() => handleQualityChange('1080p')} className={videoQuality === '1080p' ? 'active' : ''}>1080p (High)</li>
                            <li onClick={() => handleQualityChange('720p')} className={videoQuality === '720p' ? 'active' : ''}>720p (Medium)</li>
                            <li onClick={() => handleQualityChange('480p')} className={videoQuality === '480p' ? 'active' : ''}>480p (Low)</li>
                        </ul>
                    )}
                    <button className="settings-btn" onClick={() => setShowQualityMenu(prev => !prev)} aria-label="Video settings">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
                    </button>
                </div>
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
                  <h3>{currentVideo.title}</h3>
                  <p className="video-category">{currentVideo.category}</p>
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
                    className={`subscribe-btn ${currentVideo.isSubscribed ? 'subscribed' : ''}`}
                    onClick={handleSubscribeToggle}
                  >
                    {currentVideo.isSubscribed ? 'Subscribed' : 'Subscribe'}
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
              <button type="submit" disabled={!file || !title || !category}>
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


  return (
    <>
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
            <button className="profile-btn" onClick={() => setCurrentView('profile')}>Profile</button>
        </div>
      </header>
      {currentView === 'home' ? renderHomeView() : renderProfileView()}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
