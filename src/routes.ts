import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
    return res.status(200).send({
        success: true,
        message: "It Works",
        data: {},
    });
});

export default router;

