"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const flashcards = [
  { id: 1, question: "What is Next.js?", answer: "A React framework for production." },
  { id: 2, question: "What does SSG stand for?", answer: "Static Site Generation." },
  { id: 3, question: "How do you deploy Next.js?", answer: "Vercel, custom VPS, Docker, etc." },
  { id: 4, question: "What is the purpose of basePath?", answer: "To serve a Next.js app under a sub-path of a domain." },
];

export default function AnkiApp() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev: number) => (prev + 1) % flashcards.length);
    }, 150); // slight delay for smooth flipping reset
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev: number) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const toggleReset = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950 p-6">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8">
        
        {/* Header Section */}
        <div className="flex w-full items-center justify-between mb-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            ← Back Home
          </Link>
          <div className="flex items-center gap-2 text-zinc-500">
            <Image 
              src="/anki/next.svg" 
              alt="Next.js Logo" 
              width={60} 
              height={12} 
              className="opacity-50 dark:invert" 
            />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl border-b-4 border-indigo-500 pb-2 inline-block">
            Antigravity Anki
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Click the card to reveal the answer.
          </p>
        </div>

        {/* Flashcard Component */}
        <div className="relative w-full aspect-[3/2] sm:aspect-video perspective-1000">
          <div
            onClick={flipCard}
            className={`cursor-pointer w-full h-full transition-transform duration-700 transform-style-3d ${
              isFlipped ? "rotate-y-180" : ""
            }`}
          >
            {/* Front of the Card */}
            <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-800 dark:text-zinc-100 text-center leading-relaxed">
                {flashcards[currentIndex].question}
              </h2>
              <div className="absolute bottom-6 text-sm text-zinc-400 font-medium">
                Tap to flip
              </div>
            </div>

            {/* Back of the Card */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 shadow-xl border border-indigo-200 dark:border-indigo-800 p-8 sm:p-12">
              <p className="text-xl sm:text-2xl font-medium text-indigo-900 dark:text-indigo-200 text-center leading-relaxed">
                {flashcards[currentIndex].answer}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex w-full items-center justify-between px-2">
          <button
            onClick={prevCard}
            className="flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-sm border border-zinc-200 dark:border-zinc-700 h-12 px-6 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            ← Prev
          </button>
          
          <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {currentIndex + 1} / {flashcards.length}
          </div>

          <button
            onClick={nextCard}
            className="flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none h-12 px-6 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            Next →
          </button>
        </div>

        <button 
          onClick={toggleReset}
          className="mt-8 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700"
        >
          Reset Deck
        </button>
        
      </main>
    </div>
  );
}
