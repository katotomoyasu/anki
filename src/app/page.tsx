"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  category?: string; // カテゴリ追加
}

export default function AnkiApp() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 現在のカテゴリとカードのインデックス
  const [activeCategory, setActiveCategory] = useState<string>("すべて");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<"study" | "list" | "add">("study");

  // New Card State
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("");
  
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
    if (activeCategory === "すべて") return flashcards;
    return flashcards.filter(c => (c.category || "未分類") === activeCategory);
  }, [flashcards, activeCategory]);

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
      category: newCategory.trim() || "未分類"
    };
    
    setFlashcards([...flashcards, newCard]);
    setNewQuestion("");
    setNewAnswer("");
    // 連続追加しやすいようにカテゴリはそのまま残す
    alert("問題を登録しました！");
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
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImportJSON}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 rounded transition"
            >
              JSON読込
            </button>
            <button 
              onClick={handleExportJSON}
              className="text-xs font-semibold text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 rounded transition"
            >
              JSON出力
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex flex-wrap justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("study")}
            className={`px-4 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "study"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📚 Study Mode
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "list"
                ? "bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📝 List View
          </button>
          <button
            onClick={() => setViewMode("add")}
            className={`px-4 sm:px-6 py-2 rounded-md font-medium text-sm transition-all ${
              viewMode === "add"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            + Add Card
          </button>
        </div>

        {/* Categories (only show in list or study mode) */}
        {(viewMode === "list" || viewMode === "study") && (
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
                <div className="flex w-full max-w-2xl items-center justify-between px-2">
                  <button
                    onClick={prevCard}
                    className="flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-sm border border-zinc-200 dark:border-zinc-700 h-12 px-6 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    ← Prev
                  </button>
                  
                  <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    {currentIndex + 1} / {filteredCards.length}
                  </div>

                  <button
                    onClick={nextCard}
                    className="flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none h-12 px-6 rounded-full font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
                  >
                    Next →
                  </button>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={toggleReset}
                    className="mt-2 text-sm text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700"
                  >
                    最初に戻る
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
