<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MinifigElement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<MinifigElement> */
class MinifigElementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MinifigElement::class);
    }
}
