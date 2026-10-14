import grpc
import json
import app.buf.generated.ai_assistant.v1.ai_assistant_pb2 as pb2
import app.buf.generated.ai_assistant.v1.ai_assistant_pb2_grpc as pb2_grpc
from app.api.chat.service import ChatService, ChatBusyError
from app.graph.graph import agent_app
from app.utils.request_budget import request_budget

class ChatServicer(pb2_grpc.ChatServiceServicer):
    def __init__(self):
        # Initialize ChatService with LLM agent
        self.chat_service = ChatService(agent_app)

    def Chat(self, request, context):
        if not request.message or not request.message.strip():
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Field 'message' is required and cannot be empty.")
            return pb2.ChatResponse()

        session_id = request.session_id or "default_session"
        user_id = request.user_id or "default_user"
        confirm = request.confirm if request.HasField("confirm") else None

        try:
            # Process query
            with request_budget(context):
                ai_result = self.chat_service.process_query(request.message, session_id, user_id, confirm)

            return pb2.ChatResponse(
                message=ai_result.get("message", ""),
                data=json.dumps(ai_result.get("data", {})) if ai_result.get("data") else "",
                session_id=session_id,
                type=ai_result.get("type", "")
            )

        except ChatBusyError:
            context.set_code(grpc.StatusCode.RESOURCE_EXHAUSTED)
            context.set_details("A previous chat turn is still running")
            return pb2.ChatResponse()
        except TimeoutError:
            context.set_code(grpc.StatusCode.DEADLINE_EXCEEDED)
            context.set_details("Chat request deadline exceeded")
            return pb2.ChatResponse()
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Failed to process chat query: {str(e)}")
            return pb2.ChatResponse()

    def GetChatHistory(self, request, context):
        session_id = request.session_id or "default_session"
        user_id = request.user_id or "default_user"
        
        try:
            history = self.chat_service.get_chat_history(session_id, user_id)
            messages = []
            for msg in history:
                messages.append(pb2.ChatMessage(
                    id=msg["id"],
                    sender=msg["sender"],
                    text=msg["text"],
                    data=msg["data"]
                ))
            return pb2.GetChatHistoryResponse(messages=messages)
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Failed to get chat history: {str(e)}")
            return pb2.GetChatHistoryResponse()
