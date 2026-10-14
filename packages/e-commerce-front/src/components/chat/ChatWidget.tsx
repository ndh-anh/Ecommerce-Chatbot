"use client";

import React, { useState, useRef, useEffect } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "@/hooks/useAuth";

import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import {
  Fab,
  Box,
  Typography,
  IconButton,
  Paper,
  InputBase,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";

import { usePostAiChat } from "@e-commerce/api-client/endpoints/system";
import { useQuery } from "@tanstack/react-query";
import { getGetAiChatHistorySuspenseQueryOptions } from "@e-commerce/api-client/endpoints/system";

import type { Message } from "./types";
import ChatMessageItem from "./ChatMessageItem";

const HTTP_CONFLICT_STATUS = 409;

const WELCOME_MESSAGES: Message[] = [
  {
    id: "welcome",
    sender: "ai",
    text: "Xin chào! Tôi có thể giúp gì cho bạn?",
  },
];

const ChatWidgetSession = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { token, isInitialized, userId } = useAuth();
  const [sessionMessages, setMessages] = useState<Message[] | null>(null);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = usePostAiChat({
    request: { timeout: 100_000 },
    mutation: { retry: false },
  });
  const sendingRef = useRef(false);

  const historyOptions = getGetAiChatHistorySuspenseQueryOptions({
    request: { timeout: 15_000 },
  });
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
    isFetching: isHistoryFetching,
  } = useQuery({
    ...historyOptions,
    queryKey: [...historyOptions.queryKey, userId],
    enabled: Boolean(token && userId && isInitialized && isOpen),
    retry: false,
  });

  const messages =
    sessionMessages ??
    (historyData?.messages.length
      ? (historyData.messages as Message[])
      : WELCOME_MESSAGES);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, confirm?: boolean) => {
    if (!text.trim() || sendingRef.current || !userId || isHistoryLoading)
      return;
    sendingRef.current = true;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: text,
    };

    setMessages((prev) => [...(prev ?? messages), userMessage]);

    try {
      const payload: any = { message: userMessage.text };
      if (confirm !== undefined) {
        payload.confirm = confirm;
      }

      const response = await chatMutation.mutateAsync({
        data: payload,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: response.message,
        data: response.data,
        type: response.type,
      };
      setMessages((prev) => [...(prev ?? []), aiMessage]);
    } catch (error) {
      console.error("Chat error", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text:
          isAxiosError(error) && error.response?.status === HTTP_CONFLICT_STATUS
            ? "Yêu cầu trước vẫn đang xử lý. Vui lòng chờ rồi tải lại lịch sử trò chuyện."
            : "Trợ lý chưa thể hoàn thành yêu cầu. Nếu bạn vừa xác nhận đặt hàng, hãy kiểm tra lịch sử đơn hàng trước khi gửi lại.",
        type: "CHAT_ERROR",
      };
      setMessages((prev) => [...(prev ?? []), errorMessage]);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const textToSend = inputValue;
    setInputValue("");
    await sendMessage(textToSend);
  };

  if (!isInitialized) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: { xs: 1, sm: 3 },
        right: { xs: 1, sm: 3 },
        zIndex: 9999,
      }}
    >
      {!isOpen && (
        <Fab
          aria-label="chat"
          onClick={() => setIsOpen(true)}
          sx={{
            backgroundColor: "#000",
            color: "#fff",
            boxShadow: "0 4px 14px 0 rgba(0,0,0,0.39)",
            "&:hover": {
              backgroundColor: "#333",
              boxShadow: "0 6px 20px rgba(0,0,0,0.23)",
            },
          }}
        >
          <ChatIcon />
        </Fab>
      )}

      {isOpen && (
        <Paper
          elevation={12}
          sx={{
            width: { xs: "calc(100vw - 16px)", sm: 400 },
            height: 500,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "grey.100",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: "common.black",
              color: "common.white",
              p: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ChatIcon />
              <Typography variant="boldL">AI Assistant</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{
                color: "rgba(255,255,255,0.8)",
                "&:hover": { color: "common.white" },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, bgcolor: "grey.50", overflowY: "auto", p: 2 }}>
            {!token ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "text.secondary",
                  px: 2,
                  textAlign: "center",
                }}
              >
                <ChatIcon sx={{ fontSize: 48, color: "grey.400", mb: 2 }} />
                <Typography variant="regularM">
                  Bạn phải đăng nhập để thực hiện chức năng này
                </Typography>
              </Box>
            ) : (
              <>
                {isHistoryLoading && (
                  <Typography variant="regularS">
                    Đang tải lịch sử trò chuyện…
                  </Typography>
                )}
                {isHistoryError && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Chưa tải được lịch sử. Bạn vẫn có thể gửi tin nhắn mới.
                  </Alert>
                )}
                {messages.map((msg, index) => (
                  <ChatMessageItem
                    key={msg.id}
                    msg={msg}
                    onSendMessage={sendMessage}
                    disabled={
                      chatMutation.isPending || isHistoryLoading || !userId
                    }
                    isLatest={index === messages.length - 1}
                  />
                ))}
                {(isHistoryError || messages.at(-1)?.type === "CHAT_ERROR") && (
                  <Button
                    disabled={isHistoryFetching || chatMutation.isPending}
                    onClick={async () => {
                      const result = await refetchHistory();
                      if (!result.isError && result.data?.messages) {
                        setMessages(result.data.messages as Message[]);
                      }
                    }}
                  >
                    Tải lại lịch sử trò chuyện
                  </Button>
                )}
                {chatMutation.isPending && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-start",
                      mb: 2,
                    }}
                  >
                    <CircularProgress
                      size={20}
                      sx={{ color: "grey.500", ml: 2 }}
                    />
                    <Typography
                      variant="regularS"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      Trợ lý đang xử lý…
                    </Typography>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </Box>

          {/* Footer */}
          {token && (
            <Box
              sx={{
                p: 1.5,
                bgcolor: "common.white",
                borderTop: "1px solid",
                borderColor: "grey.100",
              }}
            >
              <Box
                component="form"
                onSubmit={handleSend}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  bgcolor: "grey.50",
                  borderRadius: 8,
                  pr: 0.5,
                  pl: 2,
                  py: 0.5,
                }}
              >
                <InputBase
                  sx={{ flex: 1, typography: "regularM" }}
                  placeholder="Nhập tin nhắn..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={
                    chatMutation.isPending || isHistoryLoading || !userId
                  }
                />
                <IconButton
                  type="submit"
                  disabled={
                    !inputValue.trim() ||
                    chatMutation.isPending ||
                    isHistoryLoading ||
                    !userId
                  }
                  sx={{
                    bgcolor: "common.black",
                    color: "common.white",
                    width: 32,
                    height: 32,
                    "&:hover": { bgcolor: "grey.800" },
                    "&.Mui-disabled": {
                      opacity: 0.5,
                      bgcolor: "common.black",
                      color: "common.white",
                    },
                  }}
                >
                  <SendIcon sx={{ fontSize: 16, ml: "2px" }} />
                </IconButton>
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default function ChatWidget() {
  const { userId } = useAuth();
  // Mount a separate widget per account so late replies cannot leak into another session.
  return <ChatWidgetSession key={userId || "anonymous"} />;
}
