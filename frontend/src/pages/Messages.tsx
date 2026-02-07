import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import MessageBubble from '@/components/MessageBubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, MessageSquare, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/utils/auth';
import { getChatRoomByLookId, sendMessage, markChatRoomAsRead } from '@/utils/messageStorage';
import { showSuccess, showError } from '@/utils/toast';
import { socketService } from '@/utils/socket';
import { ChatRoom, Message } from '@/types';
import { useChatRooms, useChatRoomMessages, useRefresh, queryKeys } from '@/hooks/useQueries';

const Messages = () => {
  const currentUser = getCurrentUser();
  const isStylist = currentUser?.userType === 'stylist';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRoomIdRef = useRef<string | null>(null);

  // React Query hooks
  const { data: chatRooms = [], isLoading } = useChatRooms();
  const { data: messages = [], refetch: refetchMessages } = useChatRoomMessages(
    selectedChatRoom?.id || '',
    !!selectedChatRoom
  );
  const { refreshChatRooms } = useRefresh();

  // Keep ref in sync so connect listener can join current room
  selectedChatRoomIdRef.current = selectedChatRoom?.id ?? null;

  // Initialize Socket.IO connection and re-join current room when socket connects
  useEffect(() => {
    const socket = socketService.connect();
    if (socket) {
      setIsSocketConnected(socketService.isConnected());
      
      socket.on('connect', () => {
        setIsSocketConnected(true);
        // Re-join current chat room when connection is established (handles late connect)
        const roomId = selectedChatRoomIdRef.current;
        if (roomId) socketService.joinChatRoom(roomId);
      });
      
      socket.on('disconnect', () => {
        setIsSocketConnected(false);
      });
    }
    
    return () => {
      socketService.disconnect();
      setIsSocketConnected(false);
    }; 
  }, []);

  // Check for lookId in URL params (deep link from Look page) - only auto-select when coming from a specific look
  useEffect(() => {
    const lookId = searchParams.get('lookId');
    if (lookId && chatRooms.length > 0) {
      // Find chat room for this look
      const chatRoom = chatRooms.find(cr => cr.lookId === lookId);
      if (chatRoom) {
        setSelectedChatRoom(chatRoom);
        // Clear the URL param
        navigate('/messages', { replace: true });
      } else {
        // Try to fetch chat room directly
        loadChatRoomByLookId(lookId);
      }
    }
  }, [searchParams, chatRooms, navigate]);

  // Listen for new messages in real-time (stylist receives message-received to user room even when another chat is selected)
  useEffect(() => {
    const addMessageToCacheIfSelected = (message: Message, chatRoomId: string) => {
      if (selectedChatRoom && chatRoomId === selectedChatRoom.id) {
        queryClient.setQueryData(
          queryKeys.chatRoomMessages(selectedChatRoom.id),
          (old: Message[] = []) => {
            if (old.some(m => m.id === message.id)) return old;
            return [...old, message];
          }
        );
        markChatRoomAsRead(selectedChatRoom.id).catch(console.error);
      }
    };

    const handleNewMessage = (message: Message) => {
      addMessageToCacheIfSelected(message, message.chatRoomId);
      refreshChatRooms();
    };

    const handleMessageReceived = (data: { message: Message; chatRoom: ChatRoom }) => {
      addMessageToCacheIfSelected(data.message, data.chatRoom.id);
      refreshChatRooms();
    };

    socketService.on('new-message', handleNewMessage);
    socketService.on('message-received', handleMessageReceived);
    
    return () => {
      socketService.off('new-message', handleNewMessage);
      socketService.off('message-received', handleMessageReceived);
    };
  }, [selectedChatRoom, queryClient, refreshChatRooms]);

  // Join/leave chat room socket on selection change
  useEffect(() => {
    if (selectedChatRoom) {
      markChatRoomAsRead(selectedChatRoom.id).catch(console.error);
      
      // Join Socket.IO chat room for real-time updates
      socketService.joinChatRoom(selectedChatRoom.id);
      
      return () => {
        // Leave room when chat room changes
        socketService.leaveChatRoom(selectedChatRoom.id);
      };
    }
  }, [selectedChatRoom?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatRoomByLookId = async (lookId: string) => {
    try {
      const result = await getChatRoomByLookId(lookId);
      if (result) {
        setSelectedChatRoom(result.chatRoom);
        // Refresh chat rooms to include this one
        refreshChatRooms();
        // Clear the URL param
        navigate('/messages', { replace: true });
      } else {
        showError('No chat available for this look. The look may not have been sent for approval yet.');
      }
    } catch (error) {
      console.error('Error loading chat room by look ID:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!selectedChatRoom || !messageText.trim()) return;
    
    const trimmedMessage = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX
    
    try {
      const message = await sendMessage(selectedChatRoom.id, trimmedMessage);
      
      // Optimistically add message to cache
      queryClient.setQueryData(
        queryKeys.chatRoomMessages(selectedChatRoom.id),
        (old: Message[] = []) => {
          if (old.some(m => m.id === message.id)) return old;
          return [...old, message];
        }
      );
      
      // Refresh chat rooms to update last message (without blocking UI)
      refreshChatRooms();
    } catch (error: any) {
      console.error('Error sending message:', error);
      showError(error.message || 'Failed to send message');
      // Restore message text on error
      setMessageText(trimmedMessage);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getOtherParticipantName = (chatRoom: ChatRoom) => {
    return isStylist ? chatRoom.clientName : chatRoom.stylistName;
  };

  const getOtherParticipantPhoto = (chatRoom: ChatRoom) => {
    return isStylist ? (chatRoom as any).clientPhoto : (chatRoom as any).stylistPhoto;
  };

  const getLookStatusBadge = (chatRoom: ChatRoom) => {
    if (!chatRoom.look) return null;
    
    switch (chatRoom.look.status) {
      case 'pending':
        return <Badge className="bg-yellow-500 text-xs">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 text-xs">Approved</Badge>;
      case 'changes_requested':
        return <Badge className="bg-orange-500 text-xs">Changes</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] md:h-[calc(100vh-16rem)] min-h-[320px]">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 h-full min-h-0">
          {/* Chat Room List - Left Sidebar */}
          <div className={`w-full md:w-80 flex-shrink-0 min-h-0 ${selectedChatRoom ? 'hidden md:block' : 'block'}`}>
            <Card className="h-full flex flex-col min-h-0">
              <div className="p-3 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-base sm:text-lg truncate">Look Conversations</h2>
                    <p className="text-xs text-muted-foreground">Each look has its own chat</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`h-2 w-2 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isSocketConnected ? 'Connected (real-time)' : 'Disconnected'} />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {isSocketConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2">
                  {isLoading ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : chatRooms.length === 0 ? (
                    <div className="p-8 text-center">
                      <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No look conversations yet</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {isStylist 
                          ? 'Create a look and send it for approval to start a conversation'
                          : 'Your stylist will send you looks to start a conversation'}
                      </p>
                      {isStylist && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => navigate('/looks')}
                        >
                          Go to Looks
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chatRooms.map((chatRoom) => {
                        const isSelected = selectedChatRoom?.id === chatRoom.id;
                        
                        return (
                          <Card
                            key={chatRoom.id}
                            className={`p-2.5 sm:p-3 cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-50 border-purple-200' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedChatRoom(chatRoom)}
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="relative flex-shrink-0">
                                <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                                  <AvatarImage src={getOtherParticipantPhoto(chatRoom)} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(getOtherParticipantName(chatRoom) || 'U')}
                                  </AvatarFallback>
                                </Avatar>
                                {(chatRoom.unreadCount ?? 0) > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 bg-purple-600 text-white text-[10px] sm:text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {chatRoom.unreadCount}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                                  <p className="font-medium text-sm truncate min-w-0">
                                    {chatRoom.look?.name || 'Look'}
                                  </p>
                                  <span className="flex-shrink-0">{getLookStatusBadge(chatRoom)}</span>
                                </div>
                                
                                <p className="text-xs text-muted-foreground truncate">
                                  {getOtherParticipantName(chatRoom)}
                                </p>
                                
                                {chatRoom.lastMessage && (
                                  <p className={`text-xs mt-0.5 sm:mt-1 truncate ${
                                    (chatRoom.unreadCount ?? 0) > 0 ? 'font-medium text-gray-900' : 'text-muted-foreground'
                                  }`}>
                                    {chatRoom.lastMessage.messageText.length > 40
                                      ? chatRoom.lastMessage.messageText.substring(0, 40) + '...'
                                      : chatRoom.lastMessage.messageText}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Chat Area - Right Side */}
          <Card className={`flex-1 flex flex-col min-h-0 min-w-0 ${!selectedChatRoom ? 'hidden md:flex' : 'flex'}`}>
            {selectedChatRoom ? (
              <>
                {/* Chat Header - responsive: back (mobile), avatar, title, view look */}
                <div className="relative z-10 p-3 sm:p-4 border-b flex items-center gap-2 sm:gap-3 min-h-[56px] flex-shrink-0 bg-background">
                  <button
                    type="button"
                    className="shrink-0 md:hidden p-2 -ml-2 text-foreground hover:opacity-80 active:opacity-70 touch-manipulation cursor-pointer bg-transparent border-0 rounded-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedChatRoom(null);
                    }}
                    aria-label="Back to Look Conversations"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarImage src={getOtherParticipantPhoto(selectedChatRoom)} />
                    <AvatarFallback className="text-xs">
                      {getInitials(getOtherParticipantName(selectedChatRoom) || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm sm:text-base truncate min-w-0">{selectedChatRoom.look?.name || 'Look'}</p>
                      <span className="flex-shrink-0">{getLookStatusBadge(selectedChatRoom)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {isStylist ? selectedChatRoom.clientName : selectedChatRoom.stylistName}
                    </p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-2 sm:px-3"
                    onClick={() => navigate(isStylist ? `/looks?lookId=${selectedChatRoom.lookId}` : '/looks')}
                    title="View Look"
                  >
                    <Sparkles className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">View Look</span>
                  </Button>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 min-h-0 p-3 sm:p-4">
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full min-h-[200px]">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Start the conversation about this look!
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            {isStylist 
                              ? 'Send a message to discuss this look with your client'
                              : 'Send a message to discuss this look or request changes'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.senderId === currentUser?.id}
                        senderName={
                          message.senderId === currentUser?.id
                            ? currentUser.name
                            : getOtherParticipantName(selectedChatRoom) || 'Unknown'
                        }
                        senderPhoto={
                          message.senderId === currentUser?.id
                            ? currentUser.profilePhotoUrl
                            : getOtherParticipantPhoto(selectedChatRoom)
                        }
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-3 sm:p-4 border-t flex-shrink-0">
                  <div className="flex gap-2 min-w-0">
                    <Input
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 min-w-0"
                    />
                    <Button size="icon" className="shrink-0 h-10 w-10" onClick={handleSendMessage} disabled={!messageText.trim()} aria-label="Send message">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                <div className="text-center max-w-md w-full">
                  <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Look-Based Messaging</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 px-2">
                    Each conversation is tied to a specific look. Select a look conversation to start messaging.
                  </p>
                  {chatRooms.length === 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {isStylist 
                        ? 'Create a look and send it for approval to start a conversation'
                        : 'Your stylist will send you looks to start a conversation'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
