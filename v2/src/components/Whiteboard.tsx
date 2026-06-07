import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Message, STICKY_COLORS } from '../types';
import { Plus, Trash2, Edit2, Heart, MessageCircle, Send, Pin, PinOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export function Whiteboard({ user }: { user: User | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [selectedColor, setSelectedColor] = useState(STICKY_COLORS[0]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  
  // For replies
  const [expandedRepliesMsgId, setExpandedRepliesMsgId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isTeacher = user?.email === 'hoyoboy0726@gmail.com';

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [messages]);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, []);

  const handleSaveMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    try {
      if (editingMessage) {
        await updateDoc(doc(db, 'messages', editingMessage.id), {
          text: newMessageText.trim(),
          color: selectedColor
        });
      } else {
        const messageId = crypto.randomUUID();
        await setDoc(doc(db, 'messages', messageId), {
          text: newMessageText.trim(),
          authorId: user?.uid || 'anonymous',
          authorName: user ? (user.displayName || '匿名') : (authorName.trim() || '匿名'),
          authorPhotoUrl: user?.photoURL || null,
          color: selectedColor,
          createdAt: serverTimestamp()
        });
      }
      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, editingMessage ? OperationType.UPDATE : OperationType.CREATE, 'messages');
    }
  };

  const handleEditClick = (message: Message) => {
    setEditingMessage(message);
    setNewMessageText(message.text);
    setSelectedColor(message.color || STICKY_COLORS[0]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMessage(null);
    setNewMessageText('');
    setAuthorName('');
    setSelectedColor(STICKY_COLORS[0]);
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${id}`);
    }
  };

  const handleToggleLike = async (message: Message) => {
    if (!user) {
      alert('請先使用 Google 登入才能按讚喔！');
      return;
    }
    const hasLiked = message.likes?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddReply = async (messageId: string) => {
    if (!user) {
      alert('請先使用 Google 登入才能回覆喔！');
      return;
    }
    if (!replyText.trim()) return;

    try {
      const newReply = {
        id: crypto.randomUUID(),
        text: replyText.trim(),
        authorId: user.uid,
        authorName: user.displayName || '匿名',
        authorPhotoUrl: user.photoURL || null,
        createdAt: Date.now(),
        likes: []
      };
      
      await updateDoc(doc(db, 'messages', messageId), {
        replies: arrayUnion(newReply)
      });
      setReplyText('');
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };

  const handleToggleReplyLike = async (message: Message, replyId: string) => {
    if (!user) {
      alert('請先使用 Google 登入才能按讚喔！');
      return;
    }
    if (!message.replies) return;

    const updatedReplies = message.replies.map(reply => {
      if (reply.id === replyId) {
        const currentLikes = reply.likes || [];
        const hasLiked = currentLikes.includes(user.uid);
        return {
          ...reply,
          likes: hasLiked ? currentLikes.filter(id => id !== user.uid) : [...currentLikes, user.uid]
        };
      }
      return reply;
    });

    try {
      await updateDoc(doc(db, 'messages', message.id), {
        replies: updatedReplies
      });
    } catch (error) {
      console.error("Error toggling reply like:", error);
    }
  };

  const handleTogglePin = async (message: Message) => {
    if (!isTeacher) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        isPinned: !message.isPinned
      });
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full max-w-7xl mx-auto w-full">
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
        <AnimatePresence>
          {sortedMessages.map((message) => {
              const getRotation = (id: string) => {
                const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const rotations = ['-rotate-2', '-rotate-1', 'rotate-0', 'rotate-1', 'rotate-2'];
                return rotations[sum % rotations.length];
              };
              
              const isOwnMessage = user?.uid === message.authorId && message.authorId !== 'anonymous';
              const rotationClass = getRotation(message.id);

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={message.id}
                  className={`${message.color} p-6 pb-5 rounded-sm break-inside-avoid mb-8 transition-all duration-300 relative group ${rotationClass} hover:rotate-0 hover:z-10`}
                  style={{
                    boxShadow: '3px 4px 10px rgba(0,0,0,0.08), inset 0 -3px 0 0 rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Tape */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[60px] h-[22px] bg-white/50 backdrop-blur-md shadow-sm opacity-80" style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)', transform: 'translateX(-50%) rotate(-2deg)' }}></div>

                  {/* Pinned Icon */}
                  {message.isPinned && (
                    <div className="absolute -top-2 -left-2 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 shadow-lg text-white transform -rotate-12">
                      <Pin className="w-4 h-4 fill-current" />
                    </div>
                  )}

                  {/* Header: Author & Date */}
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <div className="flex items-center gap-2">
                      {message.authorPhotoUrl ? (
                        <img src={message.authorPhotoUrl} alt={message.authorName} className="w-6 h-6 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-[10px] font-bold text-black/40">{(message.authorName || '匿').charAt(0)}</div>
                      )}
                      <span className="text-[13px] font-bold text-black/60 truncate max-w-[120px]">{message.authorName}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-black/30 tracking-tight shrink-0">{message.createdAt?.toDate ? format(message.createdAt.toDate(), 'MMM d, p') : '剛剛'}</span>
                  </div>

                  {/* Content */}
                  <p className="text-slate-800 leading-relaxed font-medium whitespace-pre-wrap mb-4 text-[15px]">{message.text}</p>
              
              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-black/5 pt-3 mt-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggleLike(message)}
                    className={`flex items-center gap-1.5 transition-colors ${user && message.likes?.includes(user.uid) ? 'text-rose-500' : 'text-black/30 hover:text-rose-400'}`}
                  >
                    <Heart className={`w-4 h-4 ${(user && message.likes?.includes(user.uid)) ? 'fill-current' : ''}`} />
                    <span className="text-sm font-bold">{message.likes?.length || 0}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (expandedRepliesMsgId === message.id) {
                        setExpandedRepliesMsgId(null);
                      } else {
                        setExpandedRepliesMsgId(message.id);
                        setReplyText('');
                      }
                    }}
                    className={`flex items-center gap-1.5 transition-colors ${expandedRepliesMsgId === message.id ? 'text-indigo-600' : 'text-black/30 hover:text-indigo-500'}`}
                  >
                    <MessageCircle className={`w-4 h-4 ${expandedRepliesMsgId === message.id ? 'fill-current' : ''}`} />
                    <span className="text-sm font-bold">{message.replies?.length || 0}</span>
                  </button>
                </div>
              </div>

              {/* Replies Section */}
              <AnimatePresence>
                {expandedRepliesMsgId === message.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="bg-black/5 p-3 rounded-xl space-y-3 shadow-inner">
                      {message.replies && message.replies.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {message.replies.map((reply) => (
                            <div key={reply.id} className="bg-white/60 rounded-lg p-3 shadow-sm border border-white/40">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  {reply.authorPhotoUrl ? (
                                    <img src={reply.authorPhotoUrl} alt={reply.authorName} className="w-5 h-5 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[9px] font-bold text-black/40">{(reply.authorName || '匿').charAt(0)}</div>
                                  )}
                                  <span className="font-bold text-gray-800 text-[13px]">{reply.authorName}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium shrink-0">{format(reply.createdAt, 'MMM d, h:mm a')}</span>
                              </div>
                              <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap pl-7 text-[13px]">{reply.text}</p>
                              <div className="mt-1 flex justify-end">
                                <button
                                  onClick={() => handleToggleReplyLike(message, reply.id)}
                                  className={`flex items-center gap-1 transition-colors ${user && reply.likes?.includes(user.uid) ? 'text-rose-500' : 'text-black/30 hover:text-rose-400'}`}
                                >
                                  <Heart className={`w-3.5 h-3.5 ${(user && reply.likes?.includes(user.uid)) ? 'fill-current' : ''}`} />
                                  <span className="text-[10px] font-bold">{reply.likes?.length || 0}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-1 items-end">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="寫下回覆..."
                          className="flex-1 bg-white/70 border-none rounded-lg px-3 py-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/50 placeholder-black/30 text-gray-800 shadow-sm transition-all resize-none overflow-hidden"
                          rows={1}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddReply(message.id);
                              // Reset height
                              if (e.currentTarget) e.currentTarget.style.height = 'auto';
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            handleAddReply(message.id);
                            // Query the textarea and reset its height
                            const textarea = document.activeElement as HTMLTextAreaElement;
                            if (textarea && textarea.tagName === 'TEXTAREA') {
                              textarea.style.height = 'auto';
                            }
                          }}
                          disabled={!replyText.trim()}
                          className="p-2 mb-0.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors shadow-sm active:scale-95 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {((user?.uid === message.authorId && message.authorId !== 'anonymous') || isTeacher) && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  {isTeacher && (
                    <button
                      onClick={() => handleTogglePin(message)}
                      className={`p-2 bg-white/50 hover:bg-yellow-500 hover:text-white rounded-full transition-all shadow-sm ${message.isPinned ? 'text-yellow-600' : 'text-slate-600'}`}
                      title={message.isPinned ? "取消置頂" : "置頂留言"}
                    >
                      {message.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  )}
                  {user?.uid === message.authorId && message.authorId !== 'anonymous' && (
                    <button
                      onClick={() => handleEditClick(message)}
                      className="p-2 bg-white/50 hover:bg-indigo-500 hover:text-white rounded-full transition-all text-indigo-600 shadow-sm"
                      title="編輯留言"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="p-2 bg-white/50 hover:bg-red-500 hover:text-white rounded-full transition-all text-red-600 shadow-sm"
                    title="刪除留言"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
              );
          })}
        </AnimatePresence>
      </div>
      
      {messages.length === 0 && (
         <div className="flex flex-col items-center justify-center pt-24 text-gray-500">
           <p>目前沒有留言，來搶頭香寫下第一則回饋吧！</p>
         </div>
      )}

      <button
        onClick={() => {
          setEditingMessage(null);
          setNewMessageText('');
          setSelectedColor(STICKY_COLORS[0]);
          setIsModalOpen(true);
        }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-[0_4px_15px_rgba(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-transform hover:scale-105 active:scale-95 z-20 hover:-translate-y-1"
      >
        <Plus className="w-7 h-7 stroke-[3]" />
      </button>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[1.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden relative border border-slate-100"
            >
              <div className="p-6 pb-2 border-b border-slate-50">
                <h2 className="text-[17px] font-extrabold text-slate-800 text-center tracking-tight flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-500" />
                  {editingMessage ? '編輯便利貼' : '留下你的便利貼'}
                </h2>
              </div>
              
              <form onSubmit={handleSaveMessage} className="p-6 pt-5 space-y-5 bg-slate-50/50">
                <div className="relative">
                  <textarea
                    autoFocus
                    placeholder="在這裡寫下你的回饋或想法..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    maxLength={500}
                    rows={5}
                    className={`w-full p-5 rounded-xl border border-black/5 outline-none resize-none placeholder-black/40 text-slate-800 text-[15px] leading-relaxed font-medium ${selectedColor} transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 shadow-inner`}
                    style={{
                      backgroundBlendMode: 'multiply'
                    }}
                  />
                  <div className="text-right text-xs text-slate-400 mt-2 font-bold">
                    {newMessageText.length}/500
                  </div>
                </div>

                {!user && !editingMessage && (
                  <div>
                    <input
                      type="text"
                      placeholder="你的暱稱 (選填)"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      maxLength={50}
                      className="w-full p-4 rounded-xl border border-slate-100 outline-none text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                    />
                  </div>
                )}

                <div className="flex gap-4 justify-center py-2">
                  {STICKY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-10 h-10 rounded-full ${color} border-[3px] transition-all ${selectedColor === color ? 'border-white scale-125 shadow-md' : 'border-transparent hover:scale-110'}`}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors shadow-[0_4px_0_0_#4f46e5] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#4f46e5] active:translate-y-[2px] active:shadow-none disabled:shadow-none disabled:translate-y-[2px]"
                  >
                    {editingMessage ? '儲存修改' : '發佈留言'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
