/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

interface Video {
  id: string;
  file: File;
  title: string;
  description: string;
  url: string;
  isSubscribed: boolean;
}

const App: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [videoDescription, setVideoDescription] = useState('');
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = (e: FormEvent) => {
    e.preventDefault();
    if (file && title) {
      const newVideo: Video = {
        id: crypto.randomUUID(),
        file,
        title,
        description,
        url: URL.createObjectURL(file),
        isSubscribed: false,
      };
      const updatedVideos = [...videos, newVideo];
      setVideos(updatedVideos);
      setCurrentVideo(newVideo);

      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      (document.getElementById('video-file') as HTMLInputElement).value = '';
      setAiResult(null);
      setVideoDescription('');
      setAnalysisPrompt('');
    }
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

    const updatedVideos = videos.map(video =>
      video.id === currentVideo.id
        ? { ...video, isSubscribed: !video.isSubscribed }
        : video
    );

    setVideos(updatedVideos);
    setCurrentVideo(prev => prev ? { ...prev, isSubscribed: !prev.isSubscribed } : null);
  };

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header>
        <h1>Aivio</h1>
        <div className="search-bar">
            <input
                type="text"
                placeholder="Search videos by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </header>
      <main>
        <div className="left-panel">
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
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your video"
                />
              </div>
              <button type="submit" disabled={!file || !title}>
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
                    {video.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="right-panel">
          <div className="video-player-container">
            {currentVideo ? (
              <video src={currentVideo.url} controls autoPlay key={currentVideo.id}></video>
            ) : (
              <p>Upload a video to start watching</p>
            )}
          </div>
          {currentVideo && (
            <>
              <div className="video-info">
                <div className="video-meta">
                  <h3>{currentVideo.title}</h3>
                  <p>{currentVideo.description}</p>
                </div>
                <button
                  className={`subscribe-btn ${currentVideo.isSubscribed ? 'subscribed' : ''}`}
                  onClick={handleSubscribeToggle}
                >
                  {currentVideo.isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
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
          )}
        </div>
      </main>
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);