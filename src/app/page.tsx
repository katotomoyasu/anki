"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  category?: string; // カテゴリ追加
  // SM-2 Algorithm specific fields
  interval?: number; // Days until next review
  repetition?: number; // Number of successful consecutive reviews
  easeFactor?: number; // Easiness factor
  nextReviewDate?: number; // Unix timestamp of next review date
}

// SM-2 Algorithm helper
const calculateNextReview = (
  quality: number, // 0-5
  repetition: number = 0,
  easeFactor: number = 2.5,
  interval: number = 0
) => {
  let newRepetition = repetition;
  let newInterval = interval;
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  if (quality < 3) {
    newRepetition = 0;
    newInterval = 1;
  } else {
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
    newRepetition += 1;
  }

  // Next review date calculation (current time + interval in days)
  const nextReviewDate = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return { repetition: newRepetition, interval: newInterval, easeFactor: newEaseFactor, nextReviewDate };
};

export default function AnkiApp() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 現在のカテゴリとカードのインデックス
  const [activeCategory, setActiveCategory] = useState<string>("すべて");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<"study" | "list" | "add" | "manage">("study");

  // New Card State
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Manage Dashboard State
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ question: string; answer: string; category: string }>({ question: "", answer: "", category: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data from localStorage or fallback to public JSON
  useEffect(() => {
    const loadCards = async () => {
      try {
        const saved = localStorage.getItem("anki_flashcards");
        if (saved) {
          setFlashcards(JSON.parse(saved));
          setIsLoading(false);
          return;
        }

        const res = await fetch('/anki/data.json');
        if (res.ok) {
          const data = await res.json();
          // 古いデータにはcategoryがないかもしれないため補完は不要だが、UI表示時に"未分類"として扱う
          setFlashcards(data);
          localStorage.setItem("anki_flashcards", JSON.stringify(data));
        }
      } catch (err) {
        console.error("データの読み込みエラー:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCards();
  }, []);

  // Save to localStorage whenever flashcards change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("anki_flashcards", JSON.stringify(flashcards));
    }
  }, [flashcards, isLoading]);

  // カテゴリ一覧の抽出と、現在選択中のカテゴリによる絞り込み
  const categories = useMemo(() => {
    const cats = flashcards.map(c => c.category || "未分類");
    return ["すべて", ...Array.from(new Set(cats))];
  }, [flashcards]);

  const filteredCards = useMemo(() => {
    let base = flashcards;
    if (activeCategory !== "すべて") {
      base = base.filter(c => (c.category || "未分類") === activeCategory);
    }
    // List view shows all in category. Study view shows only due cards.
    if (viewMode === "study") {
      const now = Date.now();
      return base.filter(c => !c.nextReviewDate || c.nextReviewDate <= now);
    }
    return base;
  }, [flashcards, activeCategory, viewMode]);

  // カテゴリ変更時にインデックスをリセットする
  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % (filteredCards.length || 1));
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % (filteredCards.length || 1));
    }, 150);
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const toggleReset = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newCard: Flashcard = {
      id: Date.now(),
      question: newQuestion,
      answer: newAnswer,
      category: newCategory.trim() || "未分類",
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: Date.now(), // Due immediately
    };
    
    setFlashcards([...flashcards, newCard]);
    setNewQuestion("");
    setNewAnswer("");
    // 連続追加しやすいようにカテゴリはそのまま残す
    alert("問題を登録しました！");
  };

  const handleBulkDelete = () => {
    if (selectedCards.size === 0) return;
    if (confirm(`選択した ${selectedCards.size} 件の問題を削除してもよろしいですか？`)) {
      const updated = flashcards.filter(c => !selectedCards.has(c.id));
      setFlashcards(updated);
      setSelectedCards(new Set());
      if (currentIndex >= updated.length) {
        setCurrentIndex(Math.max(0, updated.length - 1));
      }
    }
  };

  const handleBulkReset = () => {
    if (selectedCards.size === 0) return;
    if (confirm(`選択した ${selectedCards.size} 件の学習進捗をリセットしてもよろしいですか？（未学習状態に戻ります）`)) {
      const updated = flashcards.map(c => {
        if (selectedCards.has(c.id)) {
          return { ...c, interval: 0, repetition: 0, easeFactor: 2.5, nextReviewDate: Date.now() };
        }
        return c;
      });
      setFlashcards(updated);
      setSelectedCards(new Set());
      alert("学習進捗をリセットしました。");
    }
  };

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCards(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (selectedCards.size === filteredCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredCards.map(c => c.id)));
    }
  };

  const startEditing = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditForm({
      question: card.question,
      answer: card.answer,
      category: card.category || "未分類"
    });
  };

  const saveEdit = () => {
    if (!editingCardId) return;
    const updated = flashcards.map(c => 
      c.id === editingCardId 
        ? { ...c, question: editForm.question, answer: editForm.answer, category: editForm.category } 
        : c
    );
    setFlashcards(updated);
    setEditingCardId(null);
  };

  const handleDeleteCard = (id: number) => {
    if (confirm("この問題を削除してもよろしいですか？")) {
      const updated = flashcards.filter(c => c.id !== id);
      setFlashcards(updated);
      
      // もし現在の表示カード枚数が減ってインデックスがはみ出したら調整
      const newFilteredCount = activeCategory === "すべて" 
        ? updated.length 
        : updated.filter(c => (c.category || "未分類") === activeCategory).length;
        
      if (currentIndex >= newFilteredCount) {
        setCurrentIndex(Math.max(0, newFilteredCount - 1));
      }
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(flashcards, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "anki_deck.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          // NotebookLMなどから持ってくる時にカテゴリ情報を保証する
          const validated = imported.map((item: any, i) => ({
            id: item.id || Date.now() + i,
            question: item.question || "No Question",
            answer: item.answer || "No Answer",
            category: item.category || "未分類",
            interval: item.interval || 0,
            repetition: item.repetition || 0,
            easeFactor: item.easeFactor || 2.5,
            nextReviewDate: item.nextReviewDate || Date.now() // Default to due now if no date
          }));
          
          if (confirm(`既存のデータを上書きして ${validated.length} 件のデータを読み込みますか？\n(キャンセルすると既存のデータに追加マージします)`)) {
            setFlashcards(validated);
          } else {
            // 末尾にマージ
            setFlashcards([...flashcards, ...validated]);
          }

          setCurrentIndex(0);
          setActiveCategory("すべて");
          setViewMode("list");
          alert("データを読み込みました！");
        } else {
          alert("JSONの形式が正しくありません。配列形式のデータが必要です。");
        }
      } catch (err) {
        alert("JSONの解析に失敗しました。ファイルを確認してください。");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        </div>

        {/* View Toggle */}
        <div className="flex flex-wrap justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("study")}
            className={`px-3 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "study"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📚 Study
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "list"
                ? "bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📝 List
          </button>
          <button
            onClick={() => setViewMode("add")}
            className={`px-3 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "add"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            + Add
          </button>
          <button
            onClick={() => setViewMode("manage")}
            className={`px-3 sm:px-6 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-1 ${
              viewMode === "manage"
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            ⚙️ Manage
          </button>
        </div>

        {/* Categories (only show in list, study or manage mode) */}
        {(viewMode === "list" || viewMode === "study" || viewMode === "manage") && (
          <div className="flex w-full overflow-x-auto pb-2 gap-2 hide-scrollbar mask-edges">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  activeCategory === cat
                    ? "bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-200"
                    : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Add Card Mode */}
        {viewMode === "add" && (
          <div className="w-full mt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleAddCard} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">新しい問題を登録</h2>
              
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    カテゴリ (Category)
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    list="category-suggestions"
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="例: 統計学、日本語教師 など (空欄で未分類)"
                  />
                  <datalist id="category-suggestions">
                    {categories.filter(c => c !== "すべて").map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    問題 (Question)
                  </label>
                  <textarea
                    required
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                    rows={3}
                    placeholder="例: 標準偏差とは何ですか？"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    解答 (Answer)
                  </label>
                  <textarea
                    required
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                    rows={4}
                    placeholder="例: データのばらつきの大きさを表す指標です。"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
              >
                登録する
              </button>
            </form>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredCards.length === 0 ? (
              <p className="text-center text-zinc-500 py-10">問題が見つかりません。「+ Add Card」から登録してください。</p>
            ) : (
              <div className="grid gap-4">
                <p className="text-right text-sm text-zinc-500 font-medium">全 {filteredCards.length} 件</p>
                {filteredCards.map((card, idx) => (
                  <div key={card.id} className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <button 
                      onClick={() => handleDeleteCard(card.id)}
                      className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="この問題を削除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                    
                    <div className="mb-2">
                      <span className="inline-block px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold rounded">
                        {card.category || "未分類"}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mb-3 pr-8">
                      <span className="flex items-center justify-center min-w-[24px] h-6 mt-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2">
                        {idx + 1}
                      </span>
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-lg leading-tight mt-0.5">
                        {card.question}
                      </h3>
                    </div>
                    <div className="pl-9 text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      <span className="inline-block font-medium mr-2 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded text-xs align-middle">Answer</span>
                      {card.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Study Mode (Flashcard) */}
        {viewMode === "study" && (
          <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
            {filteredCards.length === 0 ? (
              <p className="text-center text-zinc-500 py-10 mt-10">問題が見つかりません。「+ Add Card」から登録してください。</p>
            ) : (
              <>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                  {activeCategory !== "すべて" && <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-2">[{activeCategory}]</span>}
                  カードをタップすると答えが表示されます。
                </p>

                <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] perspective-1000 max-w-2xl">
                  <div
                    onClick={flipCard}
                    className={`cursor-pointer w-full h-full transition-transform duration-700 transform-style-3d ${
                      isFlipped ? "rotate-y-180" : ""
                    }`}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12">
                      <div className="absolute top-6 left-6 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-semibold rounded">
                        {filteredCards[currentIndex]?.category || "未分類"}
                      </div>
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-zinc-800 dark:text-zinc-100 text-center leading-relaxed whitespace-pre-wrap mt-4">
                        {filteredCards[currentIndex]?.question}
                      </h2>
                      <div className="absolute bottom-6 text-sm text-zinc-400 font-medium">
                        Tap to flip
                      </div>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 shadow-xl border border-indigo-200 dark:border-indigo-800 p-8 sm:p-12 overflow-y-auto">
                      <p className="text-xl sm:text-2xl lg:text-3xl font-medium text-indigo-900 dark:text-indigo-200 text-center leading-relaxed whitespace-pre-wrap">
                        {filteredCards[currentIndex]?.answer}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                {!isFlipped ? (
                  <div className="flex w-full max-w-2xl items-center justify-center px-2">
                    <button
                      onClick={flipCard}
                      className="w-full sm:w-auto flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none h-14 px-12 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:ring-offset-2 dark:focus:ring-offset-zinc-950 text-lg"
                    >
                      答えを見る
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full max-w-2xl gap-2 sm:gap-4 px-2">
                    <button
                      onClick={() => {
                        const card = filteredCards[currentIndex];
                        const { repetition, interval, easeFactor, nextReviewDate } = calculateNextReview(1, card.repetition, card.easeFactor, card.interval);
                        const updatedCards = flashcards.map(c => c.id === card.id ? { ...c, repetition, interval, easeFactor, nextReviewDate } : c);
                        setFlashcards(updatedCards);
                        setIsFlipped(false);
                      }}
                      className="flex-1 flex flex-col items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 py-3 rounded-xl transition-colors"
                    >
                      <span className="font-bold">Again</span>
                      <span className="text-xs opacity-70 mt-1">1m</span>
                    </button>
                    <button
                      onClick={() => {
                        const card = filteredCards[currentIndex];
                        const { repetition, interval, easeFactor, nextReviewDate } = calculateNextReview(3, card.repetition, card.easeFactor, card.interval);
                        const updatedCards = flashcards.map(c => c.id === card.id ? { ...c, repetition, interval, easeFactor, nextReviewDate } : c);
                        setFlashcards(updatedCards);
                        setIsFlipped(false);
                      }}
                      className="flex-1 flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 py-3 rounded-xl transition-colors"
                    >
                      <span className="font-bold">Hard</span>
                      <span className="text-xs opacity-70 mt-1">
                        {cardIntervalToText(calculateNextReview(3, filteredCards[currentIndex].repetition, filteredCards[currentIndex].easeFactor, filteredCards[currentIndex].interval).interval)}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const card = filteredCards[currentIndex];
                        const { repetition, interval, easeFactor, nextReviewDate } = calculateNextReview(4, card.repetition, card.easeFactor, card.interval);
                        const updatedCards = flashcards.map(c => c.id === card.id ? { ...c, repetition, interval, easeFactor, nextReviewDate } : c);
                        setFlashcards(updatedCards);
                        setIsFlipped(false);
                      }}
                      className="flex-1 flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 py-3 rounded-xl transition-colors"
                    >
                      <span className="font-bold">Good</span>
                      <span className="text-xs opacity-70 mt-1">
                        {cardIntervalToText(calculateNextReview(4, filteredCards[currentIndex].repetition, filteredCards[currentIndex].easeFactor, filteredCards[currentIndex].interval).interval)}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const card = filteredCards[currentIndex];
                        const { repetition, interval, easeFactor, nextReviewDate } = calculateNextReview(5, card.repetition, card.easeFactor, card.interval);
                        const updatedCards = flashcards.map(c => c.id === card.id ? { ...c, repetition, interval, easeFactor, nextReviewDate } : c);
                        setFlashcards(updatedCards);
                        setIsFlipped(false);
                      }}
                      className="flex-1 flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 py-3 rounded-xl transition-colors"
                    >
                      <span className="font-bold">Easy</span>
                      <span className="text-xs opacity-70 mt-1">
                        {cardIntervalToText(calculateNextReview(5, filteredCards[currentIndex].repetition, filteredCards[currentIndex].easeFactor, filteredCards[currentIndex].interval).interval)}
                      </span>
                    </button>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="mt-2 text-sm text-zinc-500 font-medium">
                    今日の復習残り: <span className="font-bold">{filteredCards.length}</span> 問
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {/* Manage View */}
        {viewMode === "manage" && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full">
            
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Total Cards</span>
                <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{filteredCards.length}</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col border-l-4 border-l-indigo-500">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Due Today</span>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {filteredCards.filter(c => !c.nextReviewDate || c.nextReviewDate <= Date.now()).length}
                </span>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col border-l-4 border-l-emerald-500">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">New Cards</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {filteredCards.filter(c => (c.repetition || 0) === 0).length}
                </span>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col border-l-4 border-l-amber-500">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Mature (>21d)</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {filteredCards.filter(c => (c.interval || 0) > 21).length}
                </span>
              </div>
            </div>

            {/* Data Operations */}
            <div className="flex flex-wrap items-center justify-between bg-zinc-100 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedCards.size === 0}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 text-sm font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Delete Selected ({selectedCards.size})
                </button>
                <button
                  onClick={handleBulkReset}
                  disabled={selectedCards.size === 0}
                  className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Reset Progress
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportJSON} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-950 dark:border-zinc-700 dark:hover:bg-zinc-900 rounded transition"
                >
                  📥 Import JSON
                </button>
                <button 
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-950 dark:border-zinc-700 dark:hover:bg-zinc-900 rounded transition"
                >
                  📤 Export JSON
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedCards.size > 0 && selectedCards.size === filteredCards.length}
                          onChange={handleToggleSelectAll}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Question / Answer</th>
                      <th className="px-4 py-3 font-semibold text-right">Ease</th>
                      <th className="px-4 py-3 font-semibold text-right">Interval</th>
                      <th className="px-4 py-3 font-semibold text-right">Next Review</th>
                      <th className="px-4 py-3 font-semibold text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {filteredCards.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No cards found in this category.</td>
                      </tr>
                    ) : (
                      filteredCards.map((card) => {
                        const isDue = !card.nextReviewDate || card.nextReviewDate <= Date.now();
                        const isEditing = editingCardId === card.id;

                        return (
                          <tr key={card.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${selectedCards.has(card.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={selectedCards.has(card.id)}
                                onChange={() => handleToggleSelect(card.id)}
                                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-24 px-2 py-1 border rounded text-xs dark:bg-zinc-950 dark:border-zinc-700" />
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold rounded">
                                  {card.category || "未分類"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[300px] max-w-[400px]">
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <textarea value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} className="w-full px-2 py-1 border rounded text-xs dark:bg-zinc-950 dark:border-zinc-700 resize-y" rows={2}/>
                                  <textarea value={editForm.answer} onChange={e => setEditForm({...editForm, answer: e.target.value})} className="w-full px-2 py-1 border rounded text-xs dark:bg-zinc-950 dark:border-zinc-700 resize-y" rows={2}/>
                                </div>
                              ) : (
                                <div className="flex flex-col truncate">
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={card.question}>{card.question}</span>
                                  <span className="text-xs text-zinc-500 truncate" title={card.answer}>{card.answer}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {card.easeFactor?.toFixed(2) || "2.50"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {card.interval ? cardIntervalToText(card.interval) : "New"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                isDue ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' 
                                      : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}>
                                {isDue ? "Due Now" : new Date(card.nextReviewDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isEditing ? (
                                <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 font-semibold px-2 py-1">Save</button>
                              ) : (
                                <button onClick={() => startEditing(card)} className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-2 py-1 font-medium">
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="h-10"></div> {/* Bottom padding */}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper for UI text
function cardIntervalToText(days: number) {
  if (days < 1) return "< 1d";
  if (days === 1) return "1d";
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365 * 10) / 10}y`;
}
