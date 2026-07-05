import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import messagesRouter from "./messages";
import assignmentsRouter from "./assignments";
import videosRouter from "./videos";
import usersRouter from "./users";
import availabilityRouter from "./availability";
import parentFeedbackRouter from "./parentFeedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(messagesRouter);
router.use(assignmentsRouter);
router.use(videosRouter);
router.use(usersRouter);
router.use(availabilityRouter);
router.use(parentFeedbackRouter);

export default router;
