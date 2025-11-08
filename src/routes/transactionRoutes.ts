import express, { Request, Response } from 'express';
const router = express.Router();

router.get('/transactions', (_req: Request, res: Response) => {
    return res.status(200).send({
        success: true,
        message: "Transactions fetched successfully",
        data: {},
    });
});

module.exports = router;
