import { Router, type IRouter } from "express";
import healthRouter from "./health";
import animeRouter from "./anime";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(animeRouter);
router.use("/proxy", proxyRouter);

export default router;
