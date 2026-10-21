<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\WantedList;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<WantedList> */
class WantedListRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, WantedList::class);
    }
}
