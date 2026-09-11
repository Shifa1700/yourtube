import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  commentbody: string;
  usercommented: string;
  commentedon: string;
  editedAt?: string;
  likes?: number;
  dislikes?: number;
  parentCommentId?: string | null;
  isDeleted?: boolean;
}
const Comments = ({ videoId }: any) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [translated, setTranslated] = useState<Record<string, string>>({});
  useEffect(() => {
    loadComments();
  }, [videoId, sort]);

  const loadComments = async () => {
    try {
      const res = await axiosInstance.get(`/comment/${videoId}?sort=${sort}`);
      setComments(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (comment: Comment) => {
    try {
      const response = await axiosInstance.post("/comment/translate", {
        text: comment.commentbody,
        targetLanguage: "en",
      });
      setTranslated((previous) => ({
        ...previous,
        [comment._id]: response.data.translatedText,
      }));
    } catch (error) {
      console.error("Unable to translate comment:", error);
    }
  };

  const handleReport = async (commentId: string) => {
    if (!user) return;
    const reason = window.prompt(
      "Reason: spam, harassment, offensive, malicious-link, or other"
    );
    if (!reason) return;
    try {
      await axiosInstance.post("/comment/report", {
        commentId,
        reporterId: user._id,
        reason,
      });
    } catch (error) {
      console.error("Unable to report comment:", error);
    }
  };
  if (loading) {
    return <div>Loading history...</div>;
  }
  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post("/comment/postcomment", {
        videoid: videoId,
        userid: user._id,
        commentbody: newComment,
        usercommented: user.name,
        userimage: user.image,
        parentCommentId: replyTo,
      });
      if (res.data?._id) setComments([res.data, ...comments]);
      setNewComment("");
      setReplyTo(null);
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
  };

  const handleUpdateComment = async () => {
    if (!editText.trim()) return;
    try {
      const res = await axiosInstance.post(
        `/comment/editcomment/${editingCommentId}`,
        { commentbody: editText, userid: user?._id }
      );
      if (res.data) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === editingCommentId ? { ...c, commentbody: editText } : c
          )
        );
        setEditingCommentId(null);
        setEditText("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`, {
        data: { userid: user?._id },
      });
      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{comments.length} Comments</h2>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded border bg-background px-2 py-1 text-sm"
          aria-label="Sort comments"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most-liked">Most liked</option>
        </select>
      </div>

      {user && (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
              value={newComment}
              onChange={(e: any) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0"
            />
            <div className="flex gap-2 justify-end">
              {replyTo && (
                <Button variant="ghost" onClick={() => setReplyTo(null)}>
                  Cancel reply
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setNewComment("")}
                disabled={!newComment.trim()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="flex gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src="/placeholder.svg?height=40&width=40" />
                <AvatarFallback>{comment.usercommented[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {comment.usercommented}
                  </span>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(comment.commentedon))} ago
                    {comment.editedAt ? " · edited" : ""}
                  </span>
                </div>

                {editingCommentId === comment._id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={handleUpdateComment}
                        disabled={!editText.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">
                      {translated[comment._id] || comment.commentbody}
                    </p>
                    <div className="mt-2 flex gap-3 text-sm text-gray-500">
                      <button
                        onClick={async () => {
                          if (!user) return;
                          await axiosInstance.post(`/comment/${comment._id}/reaction`, {
                            userid: user._id,
                            reaction: "like",
                          });
                          await loadComments();
                        }}
                      >
                        Like ({comment.likes || 0})
                      </button>
                      <button onClick={() => handleTranslate(comment)}>
                        Translate
                      </button>
                      <button onClick={() => setReplyTo(comment._id)}>
                        Reply
                      </button>
                      <button onClick={() => handleReport(comment._id)}>
                        Report
                      </button>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          await axiosInstance.post(`/comment/${comment._id}/reaction`, {
                            userid: user._id,
                            reaction: "dislike",
                          });
                          await loadComments();
                        }}
                      >
                        Dislike ({comment.dislikes || 0})
                      </button>
                    </div>
                    {comment.userid === user?._id && (
                      <div className="flex gap-2 mt-2 text-sm text-gray-500">
                        <button onClick={() => handleEdit(comment)}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(comment._id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;
