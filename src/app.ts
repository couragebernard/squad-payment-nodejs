import { NextFunction, Request, Response } from "express";

const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const cors = require('cors');
require('dotenv').config();
const transactionRoutes = require('./routes/transactionRoutes');



app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || process.env.ALLOWED_ORIGINS?.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));


app.use(express.json());
app.use(cookieParser());

app.listen(process.env.PORT || 3000, () => {
    console.info(`Listening to port ${process.env.PORT || 3000}`);
});

app.get('/', (_req: Request, res: Response) => res.send('Hello World'));
app.use(transactionRoutes);


 

app.use(function (_req: Request, res: Response) {
        res.status(404).json({
            success: false,
            message: 'Route not found',
        });
});

app.use(function(err: Error, _req: Request, res: Response, _next: NextFunction){
    console.error(err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
    });
  });