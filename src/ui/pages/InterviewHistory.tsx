import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Eye, Clock, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview } from '../../types';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';

const InterviewHistory: React.FC = () => {
  const navigate = useNavigate();
  const { interviews, loadInterviews } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  useEffect(() => {
    loadInterviews();
  }, []);

  const filteredInterviews = interviews.filter((interview) => {
    const matchesSearch =
      interview.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.position.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterType === 'all' || interview.interviewType === filterType;

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (interviewId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this interview? This action cannot be undone.'
    );
    if (confirmed) {
      try {
        await window.electronAPI.deleteInterview(interviewId);
        loadInterviews();
      } catch (error) {
        console.error('Failed to delete interview:', error);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">History</h1>
          <p className="text-sm text-muted-foreground mt-1">Review your past interviews</p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="text"
                placeholder="Search interviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="system-design">System Design</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Interviews List */}
        <div className="space-y-3">
          {filteredInterviews.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare size={36} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">No interviews found matching your criteria.</p>
              </CardContent>
            </Card>
          ) : (
            filteredInterviews.map((interview) => (
              <Card key={interview.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold truncate">{interview.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {interview.company} &middot; {interview.position}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {interview.interviewType}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {format(new Date(interview.startedAt), 'MMM d, yyyy')}
                        </span>
                        {interview.duration && (
                          <span>{Math.round(interview.duration / 60)} min</span>
                        )}
                      </div>

                      {interview.feedback && (
                        <div className="mt-3 flex items-center gap-4">
                          <span className={cn('text-2xl font-bold', getScoreColor(interview.feedback.overallScore))}>
                            {interview.feedback.overallScore}%
                          </span>
                          <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                            {interview.feedback.detailedFeedback}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSelectedInterview(interview)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(interview.id)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedInterview} onOpenChange={(open) => !open && setSelectedInterview(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          {selectedInterview && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedInterview.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedInterview.company} &middot; {selectedInterview.position}
                </p>
              </DialogHeader>

              <Tabs defaultValue="feedback" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                </TabsList>

                <TabsContent value="feedback" className="flex-1 overflow-y-auto mt-4">
                  {selectedInterview.feedback ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-4">
                        <span className={cn('text-4xl font-bold', getScoreColor(selectedInterview.feedback.overallScore))}>
                          {selectedInterview.feedback.overallScore}%
                        </span>
                        <span className="text-sm text-muted-foreground">Overall Score</span>
                      </div>

                      {selectedInterview.feedback.strengths.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Strengths</h4>
                          <ul className="space-y-1">
                            {selectedInterview.feedback.strengths.map((s, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">+</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedInterview.feedback.weaknesses.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Areas for Improvement</h4>
                          <ul className="space-y-1">
                            {selectedInterview.feedback.weaknesses.map((w, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-yellow-500 mt-0.5">!</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedInterview.feedback.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suggestions</h4>
                          <ul className="space-y-1">
                            {selectedInterview.feedback.suggestions.map((s, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-primary mt-0.5">&rarr;</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detailed Feedback</h4>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {selectedInterview.feedback.detailedFeedback}
                        </p>
                      </div>

                      {/* View detailed Q/A feedback */}
                      {selectedInterview.feedback.questionFeedbacks &&
                       selectedInterview.feedback.questionFeedbacks.length > 0 && (
                        <Button
                          onClick={() => {
                            setSelectedInterview(null);
                            navigate(`/feedback/${selectedInterview.id}`);
                          }}
                          className="gap-2"
                        >
                          View Detailed Question Feedback
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No feedback available for this interview.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="transcript" className="flex-1 overflow-y-auto mt-4">
                  <div className="space-y-3">
                    {selectedInterview.transcript
                      .filter((msg) => msg.role !== 'system')
                      .map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'p-3 rounded-lg text-sm',
                            message.role === 'user'
                              ? 'bg-primary/10 ml-12'
                              : 'bg-muted mr-12'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {message.role === 'user' ? 'You' : 'Interviewer'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {format(new Date(message.timestamp), 'h:mm a')}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewHistory;
