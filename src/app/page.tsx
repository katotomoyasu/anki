"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface Flashcard {
  id: number;
  question: string;
  answer: string;
}

export default function AnkiApp() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<"study" | "list">("study");

  // Load data from JSON file located in public directory
  useEffect(() => {
    // basePathである '/anki' を付与してfetchします
    fetch('/anki/data.json')
      .then((res) => {
        if (!res.ok) throw new Error("データの取得に失敗しました");
        return res.json();
      })
      .then((data) => {
        setFlashcards(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("データの読み込みエラー:", err);
        setIsLoading(false);
      });
  }, []);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev: number) => (prev + 1) % flashcards.length);
    }, 150);
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-zinc-500 dark:text-zinc-400">Loading deck data...</p>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">No flashcards found. Check data.json.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-zinc-950 p-4 sm:p-8">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8">
        
        {/* Header Section */}
        <div className="flex w-full items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-semibold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              ← Home
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              Antigravity Anki
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Image 
              src="/anki/next.svg" 
              alt="Next.js Logo" 
              width={60} 
              height={12} 
              className="opacity-40 dark:invert" 
            />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("study")}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "study"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Study Mode
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "list"
                ? "bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            List View
          </button>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="w-full mt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-4">
              {flashcards.map((card, idx) => (
                <div key={card.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-lg">
                      {card.question}
                    </h3>
                  </div>
                  <div className="pl-9 text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium mr-2 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded text-xs">Answer</span>
                    {card.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Study Mode (Flashcard) */}
        {viewMode === "study" && (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
              Click the card to reveal the answer.
            </p>

            <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] perspective-1000 max-w-2xl">
              <div
                onClick={flipCard}
                className={`cursor-pointer w-full h-full transition-transform duration-700 transform-style-3d ${
                  isFlipped ? "rotate-y-180" : ""
                }`}
              >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-zinc-800 dark:text-zinc-100 text-center leading-relaxed">
                    {flashcards[currentIndex].question}
                  </h2>
                  <div className="absolute bottom-6 text-sm text-zinc-400 font-medium">
                    Tap to flip
                  </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 shadow-xl border border-indigo-200 dark:border-indigo-800 p-8 sm:p-12">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-medium text-indigo-900 dark:text-indigo-200 text-center leading-relaxed">
                    {flashcards[currentIndex].answer}
                  </p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex w-full max-w-2xl items-center justify-between px-2">
              <button
                onClick={prevCard}
                className="flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-sm border border-zinc-200 dark:border-zinc-700 h-12 px-6 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                ← Prev
              </button>
              
              <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
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
              className="mt-4 text-sm text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700"
            >
              Reset Deck
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
