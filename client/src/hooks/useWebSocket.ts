import { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";

const WS_URL = process.env.REACT_APP_WS_URL || "http://localhost:3001";

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // 如果未认证，断开连接
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"], // 允许降级到polling
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socket;

    // 连接成功
    socket.on("connect", () => {
      console.log("WebSocket 连接成功, Socket ID:", socket.id);
      setIsConnected(true);
      // 加入用户房间
      socket.emit("join_user_room", user.id);
    });

    // 连接错误
    socket.on("connect_error", (error) => {
      console.error("WebSocket 连接错误:", error);
      setIsConnected(false);
    });

    // 断开连接
    socket.on("disconnect", (reason) => {
      console.log("WebSocket 断开连接:", reason);
      setIsConnected(false);
    });

    // 重连尝试
    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("WebSocket 重连尝试:", attemptNumber);
    });

    // 重连成功
    socket.on("reconnect", (attemptNumber) => {
      console.log("WebSocket 重连成功:", attemptNumber);
      setIsConnected(true);
      // 重新加入用户房间
      socket.emit("join_user_room", user.id);
    });

    // 重连失败
    socket.on("reconnect_failed", () => {
      console.error("WebSocket 重连失败");
      setIsConnected(false);
    });

    // 监听各种事件

    // 激活相关事件
    socket.on("activation_created", (data) => {
      message.success(`新激活创建成功：${data.service} - ${data.phone_number}`);
      // 可以在这里更新本地状态
    });

    socket.on("activation_updated", (data) => {
      if (data.sms_code) {
        message.success(`收到短信验证码：${data.sms_code}`, 10);
        // 可以播放提示音
        playNotificationSound();
      }
      // 更新本地激活状态
    });

    socket.on("activation_cancelled", (data) => {
      message.info(`激活已取消，退款金额：$${data.refund_amount || 0}`);
    });

    // 租用相关事件
    socket.on("rental_created", (data) => {
      message.success(`号码租用成功：${data.service} - ${data.phone_number}`);
    });

    socket.on("rental_sms_received", (data) => {
      message.success(`租用号码收到新短信 (${data.new_sms_count}条)`, 8);
      playNotificationSound();
    });

    socket.on("rental_cancelled", (data) => {
      message.info(`租用已取消，退款金额：$${data.refund_amount || 0}`);
    });

    socket.on("rental_extended", (data) => {
      message.success(`租用续期成功，延长 ${data.additional_hours} 小时`);
    });

    // 余额相关事件
    socket.on("balance_updated", (data) => {
      message.info(`账户余额已更新：$${data.new_balance}`);
      // 更新用户余额
      useAuthStore.getState().updateUser({ balance: data.new_balance });
    });

    // 支付成功事件
    socket.on("payment_success", (data) => {
      console.log("收到支付成功通知:", data);

      // 更新用户余额
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().updateUser({
          ...currentUser,
          balance: data.new_balance,
          total_recharged: (currentUser.total_recharged || 0) + data.amount,
        });
      }

      // 发送自定义事件到页面组件
      const event = new CustomEvent("payment_success", { detail: data });
      window.dispatchEvent(event);
    });

    // 系统通知
    socket.on("system_notification", (data) => {
      const { type, message: msg, duration = 5 } = data;

      switch (type) {
        case "success":
          message.success(msg, duration);
          break;
        case "warning":
          message.warning(msg, duration);
          break;
        case "error":
          message.error(msg, duration);
          break;
        default:
          message.info(msg, duration);
      }
    });

    // 清理函数
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!socketRef.current) return;

    const handleActivationUpdated = (data: any) => {
      console.log("收到激活更新:", data);
      // 这里可以添加激活状态更新的处理逻辑
    };

    const handleActivationCreated = (data: any) => {
      console.log("收到新激活:", data);
      // 这里可以添加新激活的处理逻辑
    };

    const handleActivationCancelled = (data: any) => {
      console.log("收到激活取消:", data);
      // 这里可以添加激活取消的处理逻辑
    };

    const handleBalanceUpdated = (data: any) => {
      console.log("收到余额更新:", data);
      const { new_balance, change_amount, description } = data;

      // 更新本地余额
      useAuthStore.getState().updateBalance(change_amount, new_balance);

      // 显示通知
      if (change_amount > 0) {
        message.success(`余额已更新: +${change_amount} (${description})`);
      } else {
        message.info(`余额已更新: ${change_amount} (${description})`);
      }
    };

    // 监听各种事件
    socketRef.current.on("activation_updated", handleActivationUpdated);
    socketRef.current.on("activation_created", handleActivationCreated);
    socketRef.current.on("activation_cancelled", handleActivationCancelled);
    socketRef.current.on("balance_updated", handleBalanceUpdated);

    return () => {
      if (socketRef.current) {
        socketRef.current.off("activation_updated", handleActivationUpdated);
        socketRef.current.off("activation_created", handleActivationCreated);
        socketRef.current.off("activation_cancelled", handleActivationCancelled);
        socketRef.current.off("balance_updated", handleBalanceUpdated);
      }
    };
  }, []);

  // 播放通知音效
  const playNotificationSound = () => {
    try {
      // 创建简单的提示音
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // 静默处理音频播放错误
      console.log("音频播放失败:", error);
    }
  };

  // 发送消息到服务器
  const sendMessage = (event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  // 返回 WebSocket 相关方法
  return {
    socket: socketRef.current,
    isConnected: isConnected,
    sendMessage,
  };
};
