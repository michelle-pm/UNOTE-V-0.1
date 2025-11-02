import React, { useState, useEffect, useRef } from 'react';
import { Mic, StopCircle, Play, Send, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AudioRecorderProps {
    onStop: (data: { url: string, duration: number }) => void;
    // FIX: Changed the signature to accept an optional argument. This resolves the "Expected 1 arguments, but got 0" error by making the type compatible with calls that pass an argument (like implicit event handlers or error handlers) and calls that don't.
    onCancel: (error?: any) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onStop, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    // FIX: Changed NodeJS.Timeout to number for browser compatibility.
    const timerRef = useRef<number | undefined>();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setRecordedUrl(audioUrl);
                    audioChunksRef.current = [];
                    stream.getTracks().forEach(track => track.stop()); // Stop mic access
                };

                mediaRecorder.start();
                setIsRecording(true);
                // FIX: Use window.setInterval to ensure the browser's implementation is used, which returns a number.
                timerRef.current = window.setInterval(() => {
                    setDuration(prev => prev + 1);
                }, 1000);

            } catch (err) {
                console.error("Error accessing microphone:", err);
                // FIX: Pass the error to the onCancel callback to satisfy the function signature that expects an argument.
                onCancel(err);
            }
        };

        startRecording();
        
        return () => {
             // FIX: Use window.clearInterval for browser compatibility.
             if (timerRef.current) window.clearInterval(timerRef.current);
             if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                 mediaRecorderRef.current.stop();
             }
        }
    }, [onCancel]);
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // FIX: Use window.clearInterval for browser compatibility.
            if(timerRef.current) window.clearInterval(timerRef.current);
        }
    };
    
    const handleSend = () => {
        if (recordedUrl) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    onStop({ url: e.target.result as string, duration });
                }
            }
            fetch(recordedUrl).then(res => res.blob()).then(blob => reader.readAsDataURL(blob));
        }
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="p-2 bg-white/5 rounded-lg flex items-center gap-2">
            {isRecording ? (
                <>
                    <button onClick={stopRecording} className="p-2 text-red-400">
                        <StopCircle size={20} />
                    </button>
                    <div className="flex items-center gap-2 text-red-400">
                        <Mic size={16} className="animate-pulse" />
                        <span className="font-mono text-sm">{formatTime(duration)}</span>
                    </div>
                </>
            ) : recordedUrl ? (
                <>
                    <audio ref={audioRef} src={recordedUrl} className="hidden" />
                    <button onClick={() => audioRef.current?.play()} className="p-2">
                        <Play size={20} />
                    </button>
                    <div className="flex-grow bg-white/10 h-1 rounded-full" />
                    <span className="font-mono text-sm text-text-secondary">{formatTime(duration)}</span>
                     <button onClick={() => onCancel()} className="p-2 text-red-400">
                        <Trash2 size={20} />
                    </button>
                    <button onClick={handleSend} className="p-2 text-accent">
                        <Send size={20} />
                    </button>
                </>
            ) : null}
        </div>
    );
};

export default AudioRecorder;