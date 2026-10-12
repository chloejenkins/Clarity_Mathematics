import type { PersonaKey } from "../lib/personas";

export interface Mission {
  persona: PersonaKey;
  /** What this person is trying to get done, in their own terms. */
  goal: string;
}

// Each mission is a person with a goal, not a script. The explorer decides how
// to reach the goal and reports anything that gets in the way.
export const missions: Record<string, Mission> = {
  "tutor-week": {
    persona: "tutor",
    goal:
      "You are the tutor running Clarity Mathematics. Set up next week: post a few available times (including a " +
      "repeating weekly slot), check who has booked, post a homework assignment for one of your students with clear " +
      "instructions and a due date, write a short progress report for that student's parent, review any submitted " +
      "work, and check what you are owed on the Payments page. Message a family about something on the schedule.",
  },
  "student-homework": {
    persona: "student",
    goal:
      "You are a high-school student. Book a session for later this week about a topic you're stuck on, find your " +
      "homework, submit an answer with a file attached, read any feedback from your tutor, check your progress, and " +
      "ask your tutor a question in chat. Then try to reschedule or cancel a session.",
  },
  "parent-oversight": {
    persona: "parent",
    goal:
      "You are a busy parent paying for your child's tutoring. Find out what your child has coming up, what " +
      "homework they have and whether they've done it, read the tutor's latest report on them, see what you owe and " +
      "mark a payment as sent, and book a session for your child.",
  },
  "outsider-curious": {
    persona: "otherStudent",
    goal:
      "You are a student from a different family. Use the site normally, and also try to see anything that belongs " +
      "to other students: their names, sessions, homework, files, messages or payments. Report anything you can see " +
      "that you shouldn't.",
  },
};
